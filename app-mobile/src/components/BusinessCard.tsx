import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import type { BusinessSummary } from '@/api/types'

export function BusinessCard({ business }: { business: BusinessSummary }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/loja/${business.slug}`)}>
      {business.logoUrl ? (
        <Image source={{ uri: business.logoUrl }} style={styles.logo} />
      ) : (
        <View style={styles.logoPlaceholder} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{business.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {business.categoryName} · {business.city}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  logo: { width: 48, height: 48, borderRadius: 12 },
  logoPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.neutral100 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  meta: { fontSize: 12, color: colors.neutral500 },
})
