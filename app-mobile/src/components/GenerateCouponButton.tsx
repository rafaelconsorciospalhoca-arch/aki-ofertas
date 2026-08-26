import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/api/client'

export function GenerateCouponButton({ offerId }: { offerId: string }) {
  const { token, authedFetch } = useAuth()
  const queryClient = useQueryClient()
  const [code, setCode] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o cupom.')
    } finally {
      setPending(false)
    }
  }

  if (code) {
    return (
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Seu código</Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.codeHint}>Mostre este código no estabelecimento</Text>
      </View>
    )
  }

  return (
    <View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handlePress} disabled={pending}>
        {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Gerar cupom</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  error: { color: colors.red, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  codeBox: { backgroundColor: '#E9F9EF', borderRadius: 12, padding: 16, alignItems: 'center' },
  codeLabel: { fontSize: 12, color: colors.neutral500 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, color: colors.green },
  codeHint: { fontSize: 12, color: colors.neutral500, marginTop: 4 },
})
