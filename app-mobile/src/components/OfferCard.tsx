import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import type { OfferListItem } from '@/api/types'

export function OfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/oferta/${offer.slug}`)}>
      <View style={styles.imageWrapper}>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{offer.discountPercent}%</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{offer.title}</Text>
        <Text style={styles.business} numberOfLines={1}>{offer.businessName}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>{formatCents(offer.originalPrice)}</Text>
          <Text style={styles.discountPrice}>{formatCents(offer.discountPrice)}</Text>
        </View>
        {offer.distanceLabel && <Text style={styles.distance}>{offer.distanceLabel}</Text>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.neutral200 },
  imageWrapper: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.neutral100 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', backgroundColor: colors.neutral100 },
  discountBadge: { position: 'absolute', left: 4, top: 4, backgroundColor: colors.red, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  discountText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  info: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  business: { fontSize: 12, color: colors.neutral500 },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline', marginTop: 4 },
  originalPrice: { fontSize: 12, color: colors.neutral400, textDecorationLine: 'line-through' },
  discountPrice: { fontSize: 16, fontWeight: '700', color: colors.green },
  distance: { fontSize: 11, color: colors.neutral400, marginTop: 2 },
})
