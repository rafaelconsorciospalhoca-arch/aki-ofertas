import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { categoryIcon } from '@/theme/icons'
import type { Category } from '@/api/types'

const TILE_COLORS = ['#FDE8E4', '#F1E4FD', '#E4EEFD', '#FDE4EF', '#E4FDF0', '#E4E9FD', '#FDF3E4', '#E4FDFA']
const ICON_COLORS = ['#E4572E', '#8E44AD', '#2E7FE4', '#D42E7F', '#17A94E', '#4A4AE4', '#D4972E', '#2EBBAA']

function firstWord(name: string): string {
  return name.split(/[ e]/i)[0]
}

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <View style={styles.grid}>
      {categories.map((category, index) => {
        const Icon = categoryIcon(category.icon)
        const colorIndex = index % TILE_COLORS.length
        return (
          <Pressable
            key={category.id}
            style={styles.item}
            onPress={() => router.push({ pathname: '/ofertas', params: { categoria: category.id } })}
          >
            <View style={[styles.iconTile, { backgroundColor: TILE_COLORS[colorIndex] }]}>
              <Icon size={22} color={ICON_COLORS[colorIndex]} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {firstWord(category.name)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '25%', alignItems: 'center', gap: 6, marginBottom: 14 },
  iconTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600', color: colors.neutral900 },
})
