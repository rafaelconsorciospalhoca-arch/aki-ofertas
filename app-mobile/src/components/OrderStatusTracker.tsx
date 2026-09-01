import { View, Text, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import type { OrderStatus } from '@/api/types'

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'CONFIRMED', label: 'Confirmado' },
  { status: 'PREPARING', label: 'Preparando' },
  { status: 'OUT_FOR_DELIVERY', label: 'Saiu p/ entrega' },
  { status: 'DELIVERED', label: 'Entregue' },
]

// PENDING sits before every step (nothing reached yet); CANCELLED renders
// its own banner instead of the stepper below.
const STEP_INDEX: Record<OrderStatus, number> = {
  PENDING: -1,
  CONFIRMED: 0,
  PREPARING: 1,
  OUT_FOR_DELIVERY: 2,
  DELIVERED: 3,
  CANCELLED: -1,
}

export function OrderStatusTracker({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <View style={styles.cancelledBanner}>
        <Text style={styles.cancelledText}>Pedido cancelado</Text>
      </View>
    )
  }

  const currentIndex = STEP_INDEX[status]

  return (
    <View style={styles.row}>
      {STEPS.map((step, index) => {
        const reached = index <= currentIndex
        return (
          <View key={step.status} style={styles.stepWrapper}>
            <View style={styles.lineSegmentRow}>
              <View
                style={[
                  styles.lineSeg,
                  index === 0 && styles.lineHidden,
                  index <= currentIndex && styles.lineSegDone,
                ]}
              />
              <View style={[styles.circle, reached && styles.circleDone]}>
                {reached && <Check size={12} color={colors.white} />}
              </View>
              <View
                style={[
                  styles.lineSeg,
                  index === STEPS.length - 1 && styles.lineHidden,
                  index < currentIndex && styles.lineSegDone,
                ]}
              />
            </View>
            <Text style={[styles.label, reached && styles.labelDone]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 12 },
  stepWrapper: { flex: 1, alignItems: 'center' },
  lineSegmentRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  lineSeg: { flex: 1, height: 2, backgroundColor: colors.neutral200 },
  lineHidden: { backgroundColor: 'transparent' },
  lineSegDone: { backgroundColor: colors.green },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: colors.green },
  label: { fontSize: 9, color: colors.neutral400, marginTop: 4, textAlign: 'center' },
  labelDone: { color: colors.neutral900, fontWeight: '700' },
  cancelledBanner: {
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  cancelledText: { color: colors.red, fontWeight: '700', fontSize: 12 },
})
