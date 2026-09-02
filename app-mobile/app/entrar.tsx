// app-mobile/app/entrar.tsx
import { useState, useEffect } from 'react'
import { View, Text, Image, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet, Linking } from 'react-native'
import { router, Stack } from 'expo-router'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { apiFetch, ApiError } from '@/api/client'
import { GoogleIcon } from '@/components/GoogleIcon'

WebBrowser.maybeCompleteAuthSession()

type Step = 'options' | 'form' | 'code'

export default function EntrarScreen() {
  const { login } = useAuth()
  const [step, setStep] = useState<Step>('options')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState('')
  const [needsProfile, setNeedsProfile] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch((err) => console.error('AppleAuthentication.isAvailableAsync failed', err))
  }, [])

  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''
  const googleConfigured = Boolean(googleWebClientId)

  // Como o redirectUri abaixo é fixo em um domínio HTTPS (não o esquema nativo
  // reverso que o Google normalmente espera de um client iOS/Android), só um
  // client do tipo "Aplicativo da Web" pode ter esse URI autorizado. Por isso
  // reaproveitamos o mesmo client Web em todas as plataformas — não existe (e
  // não é necessário criar) um client iOS/Android separado para este fluxo.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: googleWebClientId,
    androidClientId: googleWebClientId,
    webClientId: googleWebClientId,
    // Hardcoded rather than auto-detected: `makeRedirectUri()` derives this from
    // `window.location` at render time, which is fragile (differs by entry path)
    // and must match a Google Cloud "Authorized redirect URI" exactly, or Google
    // rejects the whole request with a generic "invalid request" error.
    redirectUri: 'https://akiofertas.com.br/app/entrar',
  })

  useEffect(() => {
    if (!response) return

    if (response.type === 'success') {
      // expo-auth-session only fills `response.authentication` when the
      // response includes an access_token — the id_token-only implicit flow
      // (what useIdTokenAuthRequest requests) never sets it. The id_token is
      // in the raw returned params instead.
      const idToken = response.authentication?.idToken ?? (response.params?.id_token as string | undefined)
      if (idToken) {
        handleGoogleToken(idToken)
      } else {
        console.error('Google auth succeeded without an idToken', response)
        setError('O Google não retornou os dados esperados. Tente novamente.')
      }
      return
    }
    if (response.type === 'error') {
      console.error('Google auth error', response.error, response.params)
      setError(response.error?.description || response.error?.message || 'Não foi possível entrar com Google.')
      return
    }
    if (response.type === 'cancel' || response.type === 'dismiss') {
      setError('Login com Google cancelado.')
    }
  }, [response])

  async function handleGoogleToken(idToken: string) {
    setPending(true)
    setError(null)
    try {
      const result = await apiFetch<{ token: string; user: { id: string; name: string; email: string } }>(
        '/auth/google',
        { method: 'POST', body: { idToken } },
      )
      await login(result.token, result.user)
      router.back()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar com Google.')
    } finally {
      setPending(false)
    }
  }

  async function handleAppleSignIn() {
    setError(null)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      if (!credential.identityToken) {
        setError('A Apple não retornou os dados esperados. Tente novamente.')
        return
      }
      setPending(true)
      const result = await apiFetch<{ token: string; user: { id: string; name: string; email: string } }>(
        '/auth/apple',
        {
          method: 'POST',
          body: {
            idToken: credential.identityToken,
            // Only non-null the very first time this user signs in — Apple
            // never sends it again on later logins.
            fullName: credential.fullName
              ? { givenName: credential.fullName.givenName ?? undefined, familyName: credential.fullName.familyName ?? undefined }
              : undefined,
          },
        },
      )
      await login(result.token, result.user)
      router.back()
    } catch (err) {
      // The user closing Apple's own sheet isn't an error worth surfacing.
      if (err instanceof Error && err.message.includes('ERR_REQUEST_CANCELED')) return
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar com Apple.')
    } finally {
      setPending(false)
    }
  }

  async function handleRequestCode() {
    setPending(true)
    setError(null)
    try {
      await apiFetch('/auth/solicitar-codigo', { method: 'POST', body: { email } })
      setStep('code')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setPending(false)
    }
  }

  async function handleConfirmCode() {
    setPending(true)
    setError(null)
    try {
      const result = await apiFetch<{ token: string; user: { id: string; name: string; email: string } }>(
        '/auth/confirmar-codigo',
        {
          method: 'POST',
          body: { email, code, name, city, state, phone },
        },
      )
      await login(result.token, result.user)
      router.back()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível confirmar o código.'
      if (message === 'Informe seus dados para continuar.') {
        setNeedsProfile(true)
        setError('Primeiro acesso: preencha seus dados abaixo para concluir.')
      } else {
        setError(message)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('../assets/brand/logo.png')} style={styles.logoImage} />
          <Text style={styles.logo}>
            Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
          </Text>
          <Text style={styles.tagline}>Ofertas de comércios pertinho de você.</Text>
        </View>

        <View style={styles.card}>
          {step === 'options' && (
            <>
              <Text style={styles.title}>Bem-vindo de volta</Text>
              <Text style={styles.subtitle}>Entre para ver e resgatar as melhores ofertas da sua cidade.</Text>
              {error && <Text style={styles.error}>{error}</Text>}

              <TextInput
                style={styles.input}
                placeholder="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Pressable style={styles.primaryButton} onPress={handleRequestCode} disabled={pending || !email}>
                {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Entrar</Text>}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OU</Text>
                <View style={styles.dividerLine} />
              </View>

              {appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.appleButton}
                  onPress={handleAppleSignIn}
                />
              )}

              <Pressable
                style={[styles.googleButton, !googleConfigured && styles.disabled]}
                onPress={() => promptAsync()}
                disabled={!request || pending || !googleConfigured}
              >
                {pending ? (
                  <ActivityIndicator color={colors.green} />
                ) : (
                  <>
                    <GoogleIcon size={18} />
                    <Text style={styles.googleButtonText}>Entrar com Google</Text>
                  </>
                )}
              </Pressable>
              {!googleConfigured && (
                <Text style={styles.hintText}>Entrar com Google ainda não está disponível.</Text>
              )}

              <Pressable style={styles.secondaryButton} onPress={() => setStep('form')}>
                <Text style={styles.secondaryButtonText}>Criar conta gratuita</Text>
              </Pressable>

              <Pressable onPress={() => Linking.openURL('https://akiofertas.com.br/comerciante/cadastro')}>
                <Text style={styles.footerText}>
                  É um comerciante? <Text style={styles.footerLink}>Cadastre sua empresa</Text>
                </Text>
              </Pressable>
            </>
          )}

          {step === 'form' && (
            <>
              <Text style={styles.title}>Criar conta gratuita</Text>
              <Text style={styles.subtitle}>Preencha seus dados para começar a resgatar ofertas.</Text>
              {error && <Text style={styles.error}>{error}</Text>}
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput style={styles.input} placeholder="Seu nome" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Cidade" value={city} onChangeText={setCity} />
              <TextInput
                style={styles.input}
                placeholder="Estado (ex: PR)"
                value={state}
                onChangeText={setState}
                autoCapitalize="characters"
                maxLength={2}
              />
              <TextInput
                style={styles.input}
                placeholder="Telefone (com DDD)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Pressable
                style={styles.primaryButton}
                onPress={handleRequestCode}
                disabled={pending || !email || !name || !city || !state || !phone}
              >
                {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Enviar código</Text>}
              </Pressable>
              <Pressable onPress={() => setStep('options')}>
                <Text style={styles.hintText}>Já tem conta? Voltar para entrar</Text>
              </Pressable>
            </>
          )}

          {step === 'code' && (
            <>
              <Text style={styles.title}>Digite o código</Text>
              <Text style={styles.subtitle}>Enviamos um código de 6 dígitos para {email}</Text>
              {error && <Text style={styles.error}>{error}</Text>}
              <TextInput
                style={styles.input}
                placeholder="000000"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              {needsProfile && (
                <>
                  <TextInput style={styles.input} placeholder="Seu nome" value={name} onChangeText={setName} />
                  <TextInput style={styles.input} placeholder="Cidade" value={city} onChangeText={setCity} />
                  <TextInput
                    style={styles.input}
                    placeholder="Estado (ex: PR)"
                    value={state}
                    onChangeText={setState}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Telefone (com DDD)"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </>
              )}
              <Pressable
                style={styles.primaryButton}
                onPress={handleConfirmCode}
                disabled={pending || !code || (needsProfile && (!name || !city || !state || !phone))}
              >
                {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Confirmar</Text>}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  scroll: { flexGrow: 1 },
  header: { alignItems: 'center', paddingTop: 56, paddingBottom: 40, paddingHorizontal: 24 },
  logoImage: { width: 64, height: 64, borderRadius: 16, marginBottom: 12 },
  logo: { fontSize: 22, fontWeight: '800', color: colors.white },
  tagline: { fontSize: 13, color: colors.neutral200, fontStyle: 'italic', marginTop: 6, textAlign: 'center' },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.neutral500, textAlign: 'center', marginBottom: 4 },
  error: { color: colors.red, fontSize: 13, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  appleButton: { width: '100%', height: 48 },
  googleButton: {
    backgroundColor: '#EAF7EE',
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonText: { color: colors.green, fontWeight: '700', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.neutral200 },
  dividerText: { fontSize: 12, fontWeight: '700', color: colors.neutral400 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.green, fontWeight: '700', fontSize: 15 },
  hintText: { color: colors.neutral400, fontSize: 12, textAlign: 'center' },
  footerText: { color: colors.neutral500, fontSize: 13, textAlign: 'center', marginTop: 8 },
  footerLink: { color: colors.green, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
})
