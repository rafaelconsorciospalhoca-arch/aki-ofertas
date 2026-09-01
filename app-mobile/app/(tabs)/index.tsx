import { useEffect, useState } from 'react'
import { View, Text, Image, TextInput, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { FeaturedOfferCard } from '@/components/FeaturedOfferCard'
import { FeaturedCarousel } from '@/components/FeaturedCarousel'
import { BusinessCard } from '@/components/BusinessCard'
import { CategoryGrid } from '@/components/CategoryGrid'
import { CityPickerModal } from '@/components/CityPickerModal'
import { useFeaturedOffers } from '@/api/hooks/useFeaturedOffers'
import { useOffersList } from '@/api/hooks/useOffersList'
import { useCategories } from '@/api/hooks/useCategories'
import { useSearch } from '@/api/hooks/useSearch'
import { useAuth } from '@/auth/AuthContext'
import { useProfile } from '@/api/hooks/useProfile'
import { useLocation } from '@/location/LocationContext'
import { type StoredLocation } from '@/storage/location'
import { apiFetch } from '@/api/client'
import type { OfferListItem, BusinessSummary } from '@/api/types'

function locationLabel(location: StoredLocation | null): string | null {
  if (!location) return null
  if (location.type === 'city') return `${location.name} · ${location.state}`
  return location.cityLabel ?? 'Perto de você'
}

function firstName(name: string): string {
  return name.split(' ')[0]
}

type ResultRow = { key: string } & ({ kind: 'offer'; offer: OfferListItem } | { kind: 'business'; business: BusinessSummary })

const CAROUSEL_COUNT = 5

export default function InicioScreen() {
  const { location, setLocation } = useLocation()
  const [query, setQuery] = useState('')
  const [showCityPicker, setShowCityPicker] = useState(false)

  useEffect(() => {
    // Locations saved before city-label resolution existed (or where the lookup
    // failed at grant time) never get backfilled on their own — fill it in
    // lazily here so the real city eventually shows instead of the generic label.
    if (location?.type !== 'gps' || location.cityLabel) return

    let cancelled = false
    apiFetch<{ city: string; state: string }>(`/geocode/reverso?lat=${location.lat}&lng=${location.lng}`)
      .then((resolved) => {
        if (cancelled) return
        setLocation({ ...location, cityLabel: `${resolved.city} - ${resolved.state}` })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [location, setLocation])

  function handleSelectCity(name: string, state: string) {
    setLocation({ type: 'city', name, state })
    setShowCityPicker(false)
  }

  const { token } = useAuth()
  const profile = useProfile()
  const featured = useFeaturedOffers(location)
  const offers = useOffersList(location, {})
  const categories = useCategories()
  const search = useSearch(query)

  const featuredIds = new Set((featured.data ?? []).map((offer) => offer.id))
  const listOffers = (offers.data ?? []).filter((offer) => !featuredIds.has(offer.id))

  const greeting = token && profile.data ? `Olá, ${firstName(profile.data.name)}` : null

  if (search.active) {
    const results: ResultRow[] = [
      ...search.businesses.map((business) => ({ key: `b-${business.id}`, kind: 'business' as const, business })),
      ...search.offers.map((offer) => ({ key: `o-${offer.id}`, kind: 'offer' as const, offer })),
    ]

    return (
      <>
        <FlatList
          data={results}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={styles.navyHeader}>
                <SearchBar value={query} onChangeText={setQuery} />
              </View>
              {search.isLoading && (
                <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              {item.kind === 'offer' ? (
                <FeaturedOfferCard offer={item.offer} showTag={false} />
              ) : (
                <BusinessCard business={item.business} />
              )}
            </View>
          )}
          ListEmptyComponent={
            !search.isLoading ? <Text style={styles.emptyText}>Nada encontrado para &quot;{query}&quot;.</Text> : null
          }
        />
        <CityPickerModal visible={showCityPicker} onClose={() => setShowCityPicker(false)} onSelectCity={handleSelectCity} />
      </>
    )
  }

  return (
    <>
      <FlatList
        data={listOffers}
        keyExtractor={(offer) => offer.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
        <View>
          <View style={styles.navyHeader}>
            <View style={styles.brandRow}>
              <Image source={require('../../assets/brand/logo.png')} style={styles.logoImage} />
              <View>
                <View style={styles.brandNameRow}>
                  {greeting && <Text style={styles.greeting}>{greeting}! 👋</Text>}
                  <Text style={styles.logoText}>
                    Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
                  </Text>
                </View>
                {locationLabel(location) && (
                  <Pressable onPress={() => setShowCityPicker(true)}>
                    <Text style={styles.locationText}>📍 {locationLabel(location)} · trocar</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <SearchBar value={query} onChangeText={setQuery} />
          </View>
          <View style={styles.header}>
            <CategoryGrid categories={categories.data ?? []} />
            {(featured.data?.length ?? 0) > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Ofertas em destaque</Text>
                  <Pressable onPress={() => router.push('/ofertas')}>
                    <Text style={styles.seeAllText}>Ver todas</Text>
                  </Pressable>
                </View>
                <FeaturedCarousel offers={(featured.data ?? []).slice(0, CAROUSEL_COUNT)} />
              </>
            )}
            {offers.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
          </View>
        </View>
      }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <FeaturedOfferCard offer={item} showTag={false} />
          </View>
        )}
        ListEmptyComponent={
          !offers.isLoading ? <Text style={styles.emptyText}>Nenhuma oferta por aqui ainda.</Text> : null
        }
      />
      <CityPickerModal visible={showCityPicker} onClose={() => setShowCityPicker(false)} onSelectCity={handleSelectCity} />
    </>
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
  navyHeader: {
    backgroundColor: colors.navy,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  header: { padding: 16, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImage: { width: 36, height: 36, borderRadius: 8 },
  logoText: { fontSize: 20, fontWeight: '800', color: colors.white },
  locationText: { fontSize: 12, color: colors.neutral200, marginTop: 2, textDecorationLine: 'underline' },
  greeting: { fontSize: 14, fontWeight: '700', color: colors.white },
  searchInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  seeAllText: { color: colors.green, fontWeight: '700', fontSize: 13 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
})
