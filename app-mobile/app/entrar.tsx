// app-mobile/app/entrar.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { apiFetch, ApiError } from '@/api/client'

WebBrowser.maybeCompleteAuthSession()

type Step = 'options' | 'email' | 'code'

export default function EntrarScreen() {
  const { login } = useAuth()
  const [step, setStep] = useState<Step>('options')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [needsName, setNeedsName] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  })

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      handleGoogleToken(response.authentication.idToken)
    } else if (response?.type === 'error') {
      setError('Não foi possível entrar com Google.')
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
        { method: 'POST', body: { email, code, name: name || undefined } },
      )
      await login(result.token, result.user)
      router.back()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível confirmar o código.'
      if (message === 'Informe seu nome.') {
        setNeedsName(true)
        setError(null)
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
          <Pressable style={styles.googleButton} onPress={() => promptAsync()} disabled={!request || pending}>
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.googleButtonText}>Cadastrar com Google</Text>}
          </Pressable>
          <Pressable onPress={() => setStep('email')}>
            <Text style={styles.linkText}>Cadastro normal</Text>
          </Pressable>
        </>
      )}

      {step === 'email' && (
        <>
          <Text style={styles.title}>Digite seu e-mail</Text>
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
          {needsName && (
            <TextInput style={styles.input} placeholder="Seu nome" value={name} onChangeText={setName} />
          )}
          <Pressable style={styles.primaryButton} onPress={handleConfirmCode} disabled={pending || !code}>
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
  googleButton: { backgroundColor: colors.navy, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  googleButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.neutral500, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
  input: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
})
