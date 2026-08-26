import { useEffect, useState } from 'react'
import { View, Text, Image, TextInput, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { BusinessCard } from '@/components/BusinessCard'
import { useFeaturedOffers } from '@/api/hooks/useFeaturedOffers'
import { useCategories } from '@/api/hooks/useCategories'
import { useSearch } from '@/api/hooks/useSearch'
import { useAuth } from '@/auth/AuthContext'
import { useProfile } from '@/api/hooks/useProfile'
import { getStoredLocation, type StoredLocation } from '@/storage/location'
import type { OfferListItem, BusinessSummary } from '@/api/types'

function locationLabel(location: StoredLocation | null): string | null {
  if (!location) return null
  if (location.type === 'city') return `${location.name} · ${location.state}`
  return 'Perto de você'
}

function firstName(name: string): string {
  return name.split(' ')[0]
}

type ResultRow = { key: string } & ({ kind: 'offer'; offer: OfferListItem } | { kind: 'business'; business: BusinessSummary })

export default function InicioScreen() {
  const [location, setLocation] = useState<StoredLocation | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getStoredLocation().then(setLocation)
  }, [])

  const { token } = useAuth()
  const profile = useProfile()
  const offers = useFeaturedOffers(location)
  const categories = useCategories()
  const search = useSearch(query)

  const greeting = token && profile.data ? `Olá, ${firstName(profile.data.name)}` : null

  if (search.active) {
    const results: ResultRow[] = [
      ...search.businesses.map((business) => ({ key: `b-${business.id}`, kind: 'business' as const, business })),
      ...search.offers.map((offer) => ({ key: `o-${offer.id}`, kind: 'offer' as const, offer })),
    ]

    return (
      <FlatList
        data={results}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchBar value={query} onChangeText={setQuery} />
            {search.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            {item.kind === 'offer' ? <OfferCard offer={item.offer} /> : <BusinessCard business={item.business} />}
          </View>
        )}
        ListEmptyComponent={
          !search.isLoading ? <Text style={styles.emptyText}>Nada encontrado para &quot;{query}&quot;.</Text> : null
        }
      />
    )
  }

  return (
    <FlatList
      data={offers.data ?? []}
      keyExtractor={(offer) => offer.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          {greeting ? (
            <View>
              <Text style={styles.greeting}>{greeting}! 👋</Text>
              {locationLabel(location) && <Text style={styles.locationText}>📍 {locationLabel(location)}</Text>}
            </View>
          ) : (
            <View style={styles.brandRow}>
              <Image source={require('../../assets/brand/logo.png')} style={styles.logoImage} />
              <View>
                <Text style={styles.logoText}>
                  Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
                </Text>
                {locationLabel(location) && <Text style={styles.locationText}>📍 {locationLabel(location)}</Text>}
              </View>
            </View>
          )}
          <SearchBar value={query} onChangeText={setQuery} />
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

function SearchBar({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  return (
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      placeholder="Buscar lojas, produtos, serviços..."
      placeholderTextColor={colors.neutral400}
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
  greeting: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  categoryList: { gap: 8 },
  categoryChip: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  categoryText: { fontSize: 12, fontWeight: '600', color: colors.neutral900 },
  seeAllText: { color: colors.green, fontWeight: '700', fontSize: 13 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
})
