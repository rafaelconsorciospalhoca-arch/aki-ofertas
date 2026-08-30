import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { calculateOrderTotal } from '@/utils/orderTotal'
import { useOfferDetail } from '@/api/hooks/useOfferDetail'
import { useCreateOrder } from '@/api/hooks/useOrders'
import { useDeliveryInterest } from '@/api/hooks/useDeliveryInterest'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/api/client'
import { lookupCep } from '@/utils/cep'

const OTHER_NEIGHBORHOOD = '__other__'

export default function PedidoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { token } = useAuth()
  const { data: offer, isLoading } = useOfferDetail(slug)
  const createOrder = useCreateOrder()
  const deliveryInterest = useDeliveryInterest()

  const [quantity, setQuantity] = useState(1)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [number, setNumber] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [otherNeighborhood, setOtherNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')
  const [cep, setCep] = useState('')
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found'>('idle')
  const [cityMismatch, setCityMismatch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [interestSent, setInterestSent] = useState(false)

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

  const selectedZone = offer.deliveryZones.find((z) => z.id === selectedZoneId) ?? null
  const choosingOther = selectedZoneId === OTHER_NEIGHBORHOOD

  async function handleSubmit() {
    if (!selectedZone) return
    setError(null)
    try {
      await createOrder.mutateAsync({
        offerId: offer!.id,
        quantity,
        phone,
        address,
        number: number || undefined,
        deliveryZoneId: selectedZone.id,
        city,
        state,
        notes: notes || undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.')
    }
  }

  async function handleNotifyInterest() {
    if (!otherNeighborhood.trim()) return
    try {
      await deliveryInterest.mutateAsync({ businessId: offer!.business.id, neighborhood: otherNeighborhood.trim() })
      setInterestSent(true)
    } catch {
      setError('Não foi possível enviar o aviso. Tente novamente.')
    }
  }

  async function handleCepBlur() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepStatus('loading')
    const result = await lookupCep(cep)
    if (!result) {
      setCepStatus('not-found')
      return
    }
    setCepStatus('idle')

    const sameCity =
      result.city.trim().toLowerCase() === offer!.business.city.trim().toLowerCase() &&
      result.state.trim().toUpperCase() === offer!.business.state.trim().toUpperCase()

    if (!sameCity) {
      setCityMismatch(true)
      setSelectedZoneId(null)
      return
    }
    setCityMismatch(false)

    setAddress(result.street || address)
    setCity(result.city)
    setState(result.state)

    const matchedZone = offer!.deliveryZones.find(
      (zone) => zone.neighborhood.trim().toLowerCase() === result.neighborhood.trim().toLowerCase(),
    )
    if (matchedZone) {
      setSelectedZoneId(matchedZone.id)
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

  const subtotal = offer.discountPrice * quantity
  const total = calculateOrderTotal(subtotal, selectedZone?.feeCents ?? null)
  const canSubmit =
    !createOrder.isPending &&
    cepStatus !== 'loading' &&
    phone &&
    address &&
    city &&
    state.length === 2 &&
    !!selectedZone &&
    !cityMismatch

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
      <TextInput
        style={styles.input}
        placeholder="CEP"
        value={cep}
        onChangeText={(value) => {
          setCep(value)
          if (cepStatus !== 'idle') setCepStatus('idle')
          if (cityMismatch) setCityMismatch(false)
        }}
        onBlur={handleCepBlur}
        keyboardType="numeric"
        maxLength={9}
      />
      {cepStatus === 'loading' && <Text style={styles.cepHint}>Buscando endereço...</Text>}
      {cepStatus === 'not-found' && <Text style={styles.cepError}>CEP não encontrado, preencha manualmente.</Text>}
      {cityMismatch && (
        <Text style={styles.cepError}>
          Esse CEP é de fora da área atendida por {offer.business.name}. Você pode retirar no local usando o cupom.
        </Text>
      )}
      <TextInput style={styles.input} placeholder="Endereço" value={address} onChangeText={setAddress} />
      <TextInput style={styles.input} placeholder="Número" value={number} onChangeText={setNumber} />

      <Text style={styles.label}>Bairro</Text>
      <View style={styles.zoneList}>
        {offer.deliveryZones.map((zone) => (
          <Pressable
            key={zone.id}
            style={[styles.zoneOption, selectedZoneId === zone.id && styles.zoneOptionSelected]}
            onPress={() => setSelectedZoneId(zone.id)}
          >
            <Text style={[styles.zoneOptionText, selectedZoneId === zone.id && styles.zoneOptionTextSelected]}>
              {zone.neighborhood} — {formatCents(zone.feeCents)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.zoneOption, choosingOther && styles.zoneOptionSelected]}
          onPress={() => setSelectedZoneId(OTHER_NEIGHBORHOOD)}
        >
          <Text style={[styles.zoneOptionText, choosingOther && styles.zoneOptionTextSelected]}>
            Meu bairro não está nessa lista
          </Text>
        </Pressable>
      </View>

      {choosingOther && (
        <View style={styles.otherBox}>
          {interestSent ? (
            <Text style={styles.successText}>Aviso enviado! Você pode retirar no local usando o cupom.</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nome do seu bairro"
                value={otherNeighborhood}
                onChangeText={setOtherNeighborhood}
              />
              <Text style={styles.otherWarning}>Ainda não fazemos entrega nesse bairro.</Text>
              <Pressable
                style={styles.secondaryButtonFull}
                onPress={handleNotifyInterest}
                disabled={deliveryInterest.isPending || !otherNeighborhood.trim()}
              >
                <Text style={styles.secondaryButtonFullText}>
                  {deliveryInterest.isPending ? 'Enviando...' : 'Avisar o estabelecimento'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

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
  zoneList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneOption: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  zoneOptionSelected: { borderColor: colors.green, backgroundColor: colors.green },
  zoneOptionText: { fontSize: 13, fontWeight: '600', color: colors.neutral900 },
  zoneOptionTextSelected: { color: colors.white },
  otherBox: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.neutral100 },
  otherWarning: { fontSize: 13, color: colors.red, fontWeight: '600' },
  secondaryButtonFull: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonFullText: { color: colors.green, fontWeight: '700', fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalLabel: { fontSize: 14, color: colors.neutral500 },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.green },
  error: { color: colors.red, fontSize: 13, textAlign: 'center' },
  cepHint: { fontSize: 12, color: colors.neutral500 },
  cepError: { fontSize: 12, color: colors.red, fontWeight: '600' },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
})
