import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { BusinessCard } from '@/components/BusinessCard'
import { useAuth } from '@/auth/AuthContext'
import { useFavorites } from '@/api/hooks/useFavorites'
import type { OfferListItem, BusinessSummary } from '@/api/types'

type Row = { key: string } & ({ kind: 'offer'; offer: OfferListItem } | { kind: 'business'; business: BusinessSummary })

export default function FavoritosScreen() {
  const { token } = useAuth()
  const favorites = useFavorites()

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Entre para ver seus favoritos</Text>
        <Pressable style={styles.button} onPress={() => router.push('/entrar')}>
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  const rows: Row[] = [
    ...(favorites.data?.offers.map((offer) => ({ key: `o-${offer.id}`, kind: 'offer' as const, offer })) ?? []),
    ...(favorites.data?.businesses.map((business) => ({ key: `b-${business.id}`, kind: 'business' as const, business })) ?? []),
  ]

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.title}>Favoritos</Text>}
      ListEmptyComponent={
        favorites.isLoading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 32 }} />
        ) : (
          <Text style={styles.emptyText}>Você ainda não favoritou nada.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          {item.kind === 'offer' ? <OfferCard offer={item.offer} /> : <BusinessCard business={item.business} />}
        </View>
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
  cardWrapper: { marginBottom: 8 },
})
