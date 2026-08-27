import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { useOfferDetail } from '@/api/hooks/useOfferDetail'
import { useCreateOrder } from '@/api/hooks/useOrders'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/api/client'

export default function PedidoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { token } = useAuth()
  const { data: offer, isLoading } = useOfferDetail(slug)
  const createOrder = useCreateOrder()

  const [quantity, setQuantity] = useState(1)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Pedir com entrega' }} />
        <Text style={styles.emptyTitle}>Entre para fazer um pedido</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/entrar')}>
          <Text style={styles.primaryButtonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  if (isLoading || !offer) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Pedir com entrega' }} />
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  async function handleSubmit() {
    setError(null)
    try {
      await createOrder.mutateAsync({
        offerId: offer!.id,
        quantity,
        phone,
        address,
        number: number || undefined,
        neighborhood: neighborhood || undefined,
        city,
        state,
        notes: notes || undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.')
    }
  }

  if (success) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Pedido enviado' }} />
        <Text style={styles.emptyTitle}>Pedido enviado! 🎉</Text>
        <Text style={styles.successText}>{offer.business.name} vai confirmar seu pedido em breve.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </Pressable>
      </View>
    )
  }

  const total = offer.discountPrice * quantity
  const canSubmit = !createOrder.isPending && phone && address && city && state.length === 2

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Pedir com entrega' }} />
      <Text style={styles.title}>{offer.title}</Text>
      <Text style={styles.business}>{offer.business.name}</Text>

      <View style={styles.quantityRow}>
        <Text style={styles.label}>Quantidade</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{quantity}</Text>
          <Pressable style={styles.stepperButton} onPress={() => setQuantity((q) => q + 1)}>
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Endereço de entrega</Text>
      <TextInput style={styles.input} placeholder="Telefone (com DDD)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Endereço" value={address} onChangeText={setAddress} />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex1]} placeholder="Número" value={number} onChangeText={setNumber} />
        <TextInput style={[styles.input, styles.flex2]} placeholder="Bairro" value={neighborhood} onChangeText={setNeighborhood} />
      </View>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex2]} placeholder="Cidade" value={city} onChangeText={setCity} />
        <TextInput
          style={[styles.input, styles.flex1]}
          placeholder="UF"
          value={state}
          onChangeText={setState}
          autoCapitalize="characters"
          maxLength={2}
        />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Observações (opcional)"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCents(total)}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={!canSubmit}>
        {createOrder.isPending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Confirmar pedido</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: colors.neutral900 },
  business: { fontSize: 13, color: colors.neutral500, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, textAlign: 'center' },
  successText: { fontSize: 13, color: colors.neutral500, textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.neutral900, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.neutral900 },
  quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 18, fontWeight: '700', color: colors.neutral900 },
  stepperValue: { fontSize: 15, fontWeight: '700', color: colors.neutral900, minWidth: 20, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  input: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalLabel: { fontSize: 14, color: colors.neutral500 },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.green },
  error: { color: colors.red, fontSize: 13, textAlign: 'center' },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
})
