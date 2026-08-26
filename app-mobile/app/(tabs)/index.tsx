import { useEffect, useState } from 'react'
import { View, Text, Image, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { useFeaturedOffers } from '@/api/hooks/useFeaturedOffers'
import { useCategories } from '@/api/hooks/useCategories'
import { getStoredLocation, type StoredLocation } from '@/storage/location'

function locationLabel(location: StoredLocation | null): string | null {
  if (!location) return null
  if (location.type === 'city') return `${location.name} · ${location.state}`
  return 'Perto de você'
}

export default function InicioScreen() {
  const [location, setLocation] = useState<StoredLocation | null>(null)

  useEffect(() => {
    getStoredLocation().then(setLocation)
  }, [])

  const offers = useFeaturedOffers(location)
  const categories = useCategories()

  return (
    <FlatList
      data={offers.data ?? []}
      keyExtractor={(offer) => offer.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/brand/logo.png')} style={styles.logoImage} />
            <View>
              <Text style={styles.logoText}>
                Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
              </Text>
              {locationLabel(location) && <Text style={styles.locationText}>📍 {locationLabel(location)}</Text>}
            </View>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories.data ?? []}
            keyExtractor={(category) => category.id}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryText}>{item.name}</Text>
              </View>
            )}
          />
          <Pressable onPress={() => router.push('/ofertas')}>
            <Text style={styles.seeAllText}>Ver todas as ofertas</Text>
          </Pressable>
          {offers.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <OfferCard offer={item} />
        </View>
      )}
      ListEmptyComponent={
        !offers.isLoading ? <Text style={styles.emptyText}>Nenhuma oferta em destaque por aqui ainda.</Text> : null
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  header: { padding: 16, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImage: { width: 36, height: 36, borderRadius: 8 },
  logoText: { fontSize: 20, fontWeight: '800', color: colors.navy },
  locationText: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  categoryList: { gap: 8 },
  categoryChip: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  categoryText: { fontSize: 12, fontWeight: '600', color: colors.neutral900 },
  seeAllText: { color: colors.green, fontWeight: '700', fontSize: 13 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
})
