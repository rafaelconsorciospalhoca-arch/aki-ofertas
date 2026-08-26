import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useCoupons } from '@/api/hooks/useCoupons'

const STATUS_LABEL: Record<string, string> = { VALID: 'Válido', USED: 'Utilizado', EXPIRED: 'Expirado' }
const STATUS_COLOR: Record<string, string> = { VALID: colors.green, USED: colors.neutral400, EXPIRED: colors.red }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function CuponsScreen() {
  const { token } = useAuth()
  const coupons = useCoupons()

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Entre para ver seus cupons</Text>
        <Pressable style={styles.button} onPress={() => router.push('/entrar')}>
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <FlatList
      data={coupons.data ?? []}
      keyExtractor={(coupon) => coupon.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.title}>Meus cupons</Text>}
      ListEmptyComponent={
        coupons.isLoading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 32 }} />
        ) : (
          <Text style={styles.emptyText}>Você ainda não gerou nenhum cupom.</Text>
        )
      }
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/oferta/${item.offerSlug}`)}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.offerTitle}>{item.offerTitle}</Text>
              <Text style={styles.businessName}>{item.businessName}</Text>
            </View>
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
          </View>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.expiry}>Válido até {formatDate(item.expiresAt)}</Text>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: colors.white, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  offerTitle: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  businessName: { fontSize: 12, color: colors.neutral500 },
  status: { fontSize: 12, fontWeight: '700' },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 3, textAlign: 'center', marginTop: 12, color: colors.neutral900 },
  expiry: { fontSize: 11, color: colors.neutral500, textAlign: 'center', marginTop: 4 },
})
