import { useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native'
import { colors } from '@/theme/colors'
import { BusinessCard } from '@/components/BusinessCard'
import { useBusinessDirectory } from '@/api/hooks/useBusinessDirectory'
import { useCategories } from '@/api/hooks/useCategories'
import { useLocation } from '@/location/LocationContext'
import type { BusinessSummary } from '@/api/types'

type Row = { type: 'header'; letter: string } | { type: 'business'; business: BusinessSummary }

function groupAlphabetically(businesses: BusinessSummary[]): Row[] {
  const rows: Row[] = []
  let lastLetter = ''
  for (const business of businesses) {
    const letter = business.name.charAt(0).toUpperCase()
    if (letter !== lastLetter) {
      rows.push({ type: 'header', letter })
      lastLetter = letter
    }
    rows.push({ type: 'business', business })
  }
  return rows
}

export default function EmpresasScreen() {
  const { location } = useLocation()
  const [categoria, setCategoria] = useState<string | undefined>(undefined)

  const categories = useCategories()
  const directory = useBusinessDirectory(location, { categoria })

  const rows = groupAlphabetically(directory.data ?? [])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Empresas</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: undefined, name: 'Todos os segmentos' }, ...(categories.data ?? [])]}
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
      {directory.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
      <FlatList
        data={rows}
        keyExtractor={(row, index) => (row.type === 'header' ? `h-${row.letter}` : `b-${row.business.id}`) + index}
        contentContainerStyle={styles.list}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <Text style={styles.letterHeader}>{item.letter}</Text>
          ) : (
            <View style={styles.cardWrapper}>
              <BusinessCard business={item.business} />
            </View>
          )
        }
        ListEmptyComponent={
          !directory.isLoading ? <Text style={styles.emptyText}>Nenhuma empresa encontrada por aqui.</Text> : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  chip: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.green },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.neutral900 },
  chipTextActive: { color: colors.white },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  letterHeader: { fontSize: 13, fontWeight: '800', color: colors.neutral400, marginTop: 12, marginBottom: 6 },
  cardWrapper: { marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
})
