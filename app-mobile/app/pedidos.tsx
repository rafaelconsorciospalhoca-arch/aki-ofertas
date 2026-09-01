import { View, Text, FlatList, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { calculateOrderTotal } from '@/utils/orderTotal'
import { useOrders } from '@/api/hooks/useOrders'
import { OrderStatusTracker } from '@/components/OrderStatusTracker'
import type { OrderStatus, PaymentMethod } from '@/api/types'

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  FOOD_VOUCHER: 'Cartão Alimentação',
  MEAL_VOUCHER: 'Cartão Refeição',
  CASH: 'Dinheiro',
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: colors.neutral400,
  CONFIRMED: colors.green,
  PREPARING: colors.green,
  OUT_FOR_DELIVERY: colors.green,
  DELIVERED: colors.green,
  CANCELLED: colors.red,
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function PedidosScreen() {
  const orders = useOrders()

  return (
    <FlatList
      data={orders.data ?? []}
      keyExtractor={(order) => order.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          <Stack.Screen options={{ title: 'Meus pedidos' }} />
          <Text style={styles.title}>Meus pedidos</Text>
        </>
      }
      ListEmptyComponent={
        !orders.isLoading ? <Text style={styles.emptyText}>Você ainda não fez nenhum pedido.</Text> : null
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.offerTitle}>{item.offerTitle}</Text>
              <Text style={styles.businessName}>{item.businessName}</Text>
            </View>
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
          </View>
          <Text style={styles.meta}>
            {item.quantity}x ·{' '}
            {formatCents(
              calculateOrderTotal(
                item.discountPrice * item.quantity + (item.optionsFeeCents ?? 0),
                item.deliveryFeeCents,
              ),
            )}
          </Text>
          <Text style={styles.meta}>
            {item.address}
            {item.number ? `, ${item.number}` : ''} · {item.city}/{item.state}
          </Text>
          <Text style={styles.meta}>
            Pagamento: {PAYMENT_LABEL[item.paymentMethod]}
            {item.paymentMethod === 'CASH' && item.changeForCents
              ? ` (troco para ${formatCents(item.changeForCents)})`
              : ''}
          </Text>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          <OrderStatusTracker status={item.status} />
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  offerTitle: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  businessName: { fontSize: 12, color: colors.neutral500 },
  status: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 12, color: colors.neutral500, marginTop: 6 },
  date: { fontSize: 11, color: colors.neutral400, marginTop: 4 },
})
