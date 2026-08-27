import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Star } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import type { OfferListItem } from '@/api/types'

export function FeaturedOfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/oferta/${offer.slug}`)}>
      <View style={styles.imageWrapper}>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.tag}>
          <Text style={styles.tagText}>OFERTA ESPECIAL</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.price}>{formatCents(offer.discountPrice)}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{offer.title}</Text>
          {offer.rating && (
            <View style={styles.ratingBadge}>
              <Star size={11} color={colors.amber} fill={colors.amber} />
              <Text style={styles.ratingText}>{offer.rating.average.toFixed(1)}</Text>
            </View>
          )}
        </View>
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
  imageWrapper: { width: '100%', height: 140, backgroundColor: colors.neutral100 },
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
  info: { padding: 12, gap: 2 },
  price: { fontSize: 20, fontWeight: '800', color: colors.green },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13, color: colors.neutral500, flexShrink: 1 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '700', color: colors.neutral900 },
  distance: { fontSize: 11, color: colors.neutral400, marginTop: 4 },
})
