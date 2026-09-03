import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Star } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import type { OfferListItem } from '@/api/types'

export function FeaturedOfferCard({ offer, showTag = true }: { offer: OfferListItem; showTag?: boolean }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/oferta/${offer.slug}`)}>
      <View style={styles.imageWrapper}>
        {offer.imageUrl ? (
          <Image
            source={{ uri: offer.imageUrl }}
            style={styles.image}
            contentFit="cover"
            contentPosition="top"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        {showTag && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>OFERTA ESPECIAL</Text>
          </View>
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{offer.discountPercent}%</Text>
        </View>
      </View>
      <View style={styles.info}>
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>De {formatCents(offer.originalPrice)}</Text>
          <Text style={styles.price}>por {formatCents(offer.discountPrice)}</Text>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{offer.title}</Text>
          {offer.rating && (
            <View style={styles.ratingBadge}>
              <Star size={11} color={colors.amber} fill={colors.amber} />
              <Text style={styles.ratingText}>{offer.rating.average.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.businessName} numberOfLines={1}>{offer.businessName}</Text>
        {offer.distanceLabel && <Text style={styles.distance}>📍 {offer.distanceLabel}</Text>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: colors.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  imageWrapper: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.neutral100 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', backgroundColor: colors.neutral100 },
  tag: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: colors.green,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  discountBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  discountText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  info: { padding: 12, gap: 2 },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  originalPrice: { fontSize: 13, color: colors.neutral400, textDecorationLine: 'line-through' },
  price: { fontSize: 20, fontWeight: '800', color: colors.green },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13, color: colors.neutral500, flexShrink: 1 },
  businessName: { fontSize: 12, fontWeight: '600', color: colors.neutral400, marginTop: 1 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '700', color: colors.neutral900 },
  distance: { fontSize: 11, color: colors.neutral400, marginTop: 4 },
})
