// app-mobile/app/entrar.tsx
import { useState } from 'react'
import { View, Text, Image, TextInput, Pressable, ActivityIndicator, ScrollView, StyleSheet, Linking } from 'react-native'
import { router, Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { apiFetch, ApiError } from '@/api/client'

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
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
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
