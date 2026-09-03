import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Star } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { optimizedImageUrl } from '@/utils/optimizedImageUrl'
import type { OfferListItem } from '@/api/types'

export function OfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/oferta/${offer.slug}`)}>
      <View style={styles.imageWrapper}>
        {offer.imageUrl ? (
          <Image
            source={{ uri: optimizedImageUrl(offer.imageUrl, 150) }}
            style={styles.image}
            contentFit="cover"
            contentPosition="top"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{offer.discountPercent}%</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{offer.title}</Text>
        <View style={styles.businessRow}>
          <Text style={styles.business} numberOfLines={1}>{offer.businessName}</Text>
          {offer.rating && (
            <View style={styles.ratingBadge}>
              <Star size={11} color={colors.amber} fill={colors.amber} />
              <Text style={styles.ratingText}>{offer.rating.average.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>De {formatCents(offer.originalPrice)}</Text>
          <Text style={styles.discountPrice}>por {formatCents(offer.discountPrice)}</Text>
        </View>
        {offer.distanceLabel && <Text style={styles.distance}>{offer.distanceLabel}</Text>}
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
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  imageWrapper: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.neutral100 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', backgroundColor: colors.neutral100 },
  discountBadge: { position: 'absolute', left: 4, top: 4, backgroundColor: colors.red, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  discountText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  info: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  businessRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  business: { fontSize: 12, color: colors.neutral500, flexShrink: 1 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '700', color: colors.neutral900 },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline', marginTop: 4 },
  originalPrice: { fontSize: 12, color: colors.neutral400, textDecorationLine: 'line-through' },
  discountPrice: { fontSize: 16, fontWeight: '700', color: colors.green },
  distance: { fontSize: 11, color: colors.neutral400, marginTop: 2 },
})
