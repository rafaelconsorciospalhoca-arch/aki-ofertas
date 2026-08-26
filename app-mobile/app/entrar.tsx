// app-mobile/app/entrar.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
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

  // Nenhum projeto Google Cloud existe ainda para este app, então as variáveis
  // abaixo ficam vazias. `useAuthRequest` lança se receber `undefined`, o que
  // derrubaria a tela inteira (inclusive o fluxo de e-mail + código).
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  )

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    // Hardcoded rather than auto-detected: `makeRedirectUri()` derives this from
    // `window.location` at render time, which is fragile (differs by entry path)
    // and must match a Google Cloud "Authorized redirect URI" exactly, or Google
    // rejects the whole request with a generic "invalid request" error.
    redirectUri: 'https://akiofertas.com.br/app/entrar',
  })

  useEffect(() => {
    if (!response) return

    if (response.type === 'success' && response.authentication?.idToken) {
      handleGoogleToken(response.authentication.idToken)
      return
    }
    if (response.type === 'success') {
      // Google returned but without an idToken — should not happen with
      // useIdTokenAuthRequest, but fail loudly instead of doing nothing.
      console.error('Google auth succeeded without an idToken', response)
      setError('O Google não retornou os dados esperados. Tente novamente.')
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
      <Stack.Screen options={{ title: 'Entrar', presentation: 'modal' }} />

      {step === 'options' && (
        <>
          <Text style={styles.title}>Entrar no Aki Ofertas</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[styles.googleButton, !googleConfigured && styles.googleButtonDisabled]}
            onPress={() => promptAsync()}
            disabled={!request || pending || !googleConfigured}
          >
            {pending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <View style={styles.googleIconBadge}>
                  <GoogleIcon size={16} />
                </View>
                <Text style={styles.googleButtonText}>Continuar com Google</Text>
              </>
            )}
          </Pressable>
          {!googleConfigured && (
            <Text style={styles.subtitle}>Entrar com Google ainda não está disponível.</Text>
          )}
          <Pressable style={styles.secondaryButton} onPress={() => setStep('form')}>
            <Text style={styles.secondaryButtonText}>Continuar com e-mail</Text>
          </Pressable>
          <Text style={styles.hintText}>Já tem conta? Use a mesma opção que usou da primeira vez.</Text>
        </>
      )}

      {step === 'form' && (
        <>
          <Text style={styles.title}>Entrar com e-mail</Text>
          <Text style={styles.subtitle}>Já tem conta? Só o e-mail. Primeiro acesso? Preencha tudo pra ir mais rápido.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput style={styles.input} placeholder="Seu nome (primeiro acesso)" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Cidade (primeiro acesso)" value={city} onChangeText={setCity} />
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
          <Pressable style={styles.primaryButton} onPress={handleRequestCode} disabled={pending || !email}>
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Enviar código</Text>}
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
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.neutral500, textAlign: 'center', marginBottom: 8 },
  error: { color: colors.red, fontSize: 13, textAlign: 'center' },
  googleButton: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonDisabled: { opacity: 0.4 },
  googleIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: { color: colors.neutral900, fontWeight: '700', fontSize: 15 },
  hintText: { color: colors.neutral400, fontSize: 12, textAlign: 'center', marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
})
