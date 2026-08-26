import { useEffect, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { useOffersList } from '@/api/hooks/useOffersList'
import { useCategories } from '@/api/hooks/useCategories'
import { getStoredLocation, type StoredLocation } from '@/storage/location'

const RADIUS_OPTIONS = [1, 3, 5, 10, 20]

export default function OfertasScreen() {
  const params = useLocalSearchParams<{ categoria?: string }>()
  const [location, setLocation] = useState<StoredLocation | null>(null)
  const [categoria, setCategoria] = useState<string | undefined>(params.categoria)
  const [raio, setRaio] = useState<number | undefined>(undefined)

  useEffect(() => {
    getStoredLocation().then(setLocation)
  }, [])

  const categories = useCategories()
  const offers = useOffersList(location, { categoria, raio })

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Ofertas' }} />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: undefined, name: 'Todas' }, ...(categories.data ?? [])]}
        keyExtractor={(item) => item.id ?? 'all'}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, categoria === item.id && styles.chipActive]}
            onPress={() => setCategoria(item.id)}
          >
            <Text style={[styles.chipText, categoria === item.id && styles.chipTextActive]}>{item.name}</Text>
          </Pressable>
        )}
      />
      {location?.type === 'gps' && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ label: 'Toda cidade', value: undefined }, ...RADIUS_OPTIONS.map((km) => ({ label: `Até ${km} km`, value: km }))]}
          keyExtractor={(item) => String(item.value ?? 'all')}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chipSmall, raio === item.value && styles.chipActive]}
              onPress={() => setRaio(item.value)}
            >
              <Text style={[styles.chipText, raio === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      )}
      {offers.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
      <FlatList
        data={offers.data ?? []}
        keyExtractor={(offer) => offer.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <OfferCard offer={item} />
          </View>
        )}
        ListEmptyComponent={
          !offers.isLoading ? <Text style={styles.emptyText}>Nenhuma oferta encontrada com esses filtros.</Text> : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipSmall: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: colors.green },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.neutral900 },
  chipTextActive: { color: colors.white },
  list: { paddingVertical: 8 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
})
