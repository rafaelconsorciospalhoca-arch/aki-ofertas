import { useState, type ReactNode } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import QRCode from 'react-native-qrcode-svg'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/api/client'

const PHONE_REQUIRED_MESSAGE = 'Informe seu telefone para resgatar o cupom.'

export function GenerateCouponButton({ offerId, icon }: { offerId: string; icon?: ReactNode }) {
  const { token, authedFetch } = useAuth()
  const queryClient = useQueryClient()
  const [code, setCode] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsPhone, setNeedsPhone] = useState(false)
  const [phone, setPhone] = useState('')

  async function handlePress() {
    if (!token) {
      router.push('/entrar')
      return
    }

    setPending(true)
    setError(null)
    try {
      const result = await authedFetch<{ coupon: { code: string } }>('/cupons/gerar', {
        method: 'POST',
        body: { offerId },
      })
      setCode(result.coupon.code)
      queryClient.invalidateQueries({ queryKey: ['cupons'] })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível gerar o cupom.'
      if (message === PHONE_REQUIRED_MESSAGE) {
        setNeedsPhone(true)
      } else {
        setError(message)
      }
    } finally {
      setPending(false)
    }
  }

  async function handleSavePhone() {
    setPending(true)
    setError(null)
    try {
      await authedFetch('/perfil/telefone', { method: 'POST', body: { phone } })
      setNeedsPhone(false)
      await handlePress()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o telefone.')
      setPending(false)
    }
  }

  if (code) {
    return (
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Seu código</Text>
        <View style={styles.qrWrapper}>
          <QRCode value={code} size={140} />
        </View>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.codeHint}>Mostre este código no estabelecimento</Text>
      </View>
    )
  }

  if (needsPhone) {
    return (
      <View>
        <Text style={styles.phonePrompt}>Pra resgatar o cupom, informe seu telefone:</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TextInput
          style={styles.input}
          placeholder="Telefone (com DDD)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Pressable style={styles.button} onPress={handleSavePhone} disabled={pending || !phone}>
          {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Confirmar telefone</Text>}
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handlePress} disabled={pending}>
        {pending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            {icon}
            <Text style={styles.buttonText}>Usar cupom</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  error: { color: colors.red, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  codeBox: { backgroundColor: '#E9F9EF', borderRadius: 12, padding: 16, alignItems: 'center' },
  codeLabel: { fontSize: 12, color: colors.neutral500 },
  qrWrapper: { backgroundColor: colors.white, borderRadius: 12, padding: 12, marginTop: 8 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, color: colors.green },
  codeHint: { fontSize: 12, color: colors.neutral500, marginTop: 4 },
  phonePrompt: { fontSize: 13, color: colors.neutral900, textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 8,
  },
})
