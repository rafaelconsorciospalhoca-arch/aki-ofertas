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

type Step = 'options' | 'form'

export default function EntrarScreen() {
  const { login } = useAuth()
  const [step, setStep] = useState<Step>('options')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Nenhum projeto Google Cloud existe ainda para este app, então as variáveis
  // abaixo ficam vazias. `useAuthRequest` lança se receber `undefined`, o que
  // derrubaria a tela inteira (inclusive o fluxo de e-mail).
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  )

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
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

  async function handleSubmit() {
    setPending(true)
    setError(null)
    try {
      const result = await apiFetch<{ token: string; user: { id: string; name: string; email: string } }>(
        '/auth/entrar',
        {
          method: 'POST',
          body: {
            email,
            name: name || undefined,
            city: city || undefined,
            state: state || undefined,
            phone: phone || undefined,
          },
        },
      )
      await login(result.token, result.user)
      router.back()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.')
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
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.googleButtonText}>Cadastrar com Google</Text>}
          </Pressable>
          {!googleConfigured && (
            <Text style={styles.subtitle}>Entrar com Google ainda não está disponível.</Text>
          )}
          <Pressable onPress={() => setStep('form')}>
            <Text style={styles.linkText}>Cadastro normal</Text>
          </Pressable>
        </>
      )}

      {step === 'form' && (
        <>
          <Text style={styles.title}>Seus dados</Text>
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
            onPress={handleSubmit}
            disabled={pending || !email || !name || !city || !state || !phone}
          >
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Entrar</Text>}
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
  googleButtonDisabled: { opacity: 0.4 },
  googleButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.neutral500, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
  input: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
})
