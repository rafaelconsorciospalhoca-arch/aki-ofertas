import { View, Text, Image, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { useBusinessDetail } from '@/api/hooks/useBusinessDetail'

export default function LojaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: business, isLoading } = useBusinessDetail(slug)

  if (isLoading || !business) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  return (
    <FlatList
      data={business.offers}
      keyExtractor={(offer) => offer.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <Stack.Screen options={{ title: business.name }} />
          {business.coverUrl ? (
            <Image source={{ uri: business.coverUrl }} style={styles.cover} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View style={styles.header}>
            <Text style={styles.name}>{business.name}</Text>
            <Text style={styles.category}>{business.categoryName}</Text>
            <Text style={styles.location}>{business.city} · {business.state}</Text>
            {business.description && <Text style={styles.description}>{business.description}</Text>}
            <Text style={styles.offersTitle}>Ofertas</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <OfferCard offer={item} />
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma oferta ativa no momento.</Text>}
    />
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 24 },
  cover: { width: '100%', height: 140 },
  coverPlaceholder: { width: '100%', height: 140, backgroundColor: colors.neutral100 },
  header: { padding: 16, gap: 4 },
  name: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  category: { fontSize: 13, color: colors.green, fontWeight: '600' },
  location: { fontSize: 13, color: colors.neutral500 },
  description: { fontSize: 14, color: colors.neutral500, marginTop: 8, lineHeight: 20 },
  offersTitle: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 16, paddingHorizontal: 16 },
})
