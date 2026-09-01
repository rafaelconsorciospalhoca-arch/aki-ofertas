import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, StyleSheet, Share, Linking } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { ArrowLeft, Share2, Navigation, Ticket, Bike } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { useOfferDetail } from '@/api/hooks/useOfferDetail'
import { GenerateCouponButton } from '@/components/GenerateCouponButton'
import { HeartButton } from '@/components/HeartButton'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function OfertaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: offer, isLoading } = useOfferDetail(slug)

  if (isLoading || !offer) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  function handleShare() {
    Share.share({ message: `${offer!.title} - ${offer!.business.name} no Aki Ofertas` })
  }

  function handleDirections() {
    const query = encodeURIComponent(`${offer!.business.name}, ${offer!.business.city} - ${offer!.business.state}`)
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
  }

  const hasDelivery = offer.deliveryEnabled && offer.deliveryZones.length > 0
  const deliveryOnly = hasDelivery && !offer.business.acceptsPickup

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.imageWrapper}>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{offer.discountPercent}%</Text>
        </View>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.neutral900} />
          </Pressable>
          <View style={styles.topBarRight}>
            <HeartButton target={{ offerId: offer.id }} />
            <Pressable style={styles.iconButton} onPress={handleShare}>
              <Share2 size={18} color={colors.neutral900} />
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.content}>
        <Pressable onPress={() => router.push(`/loja/${offer.business.slug}`)}>
          <Text style={styles.business}>{offer.business.name}</Text>
        </Pressable>
        <Text style={styles.title}>{offer.title}</Text>
        {offer.description && <Text style={styles.description}>{offer.description}</Text>}
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>{formatCents(offer.originalPrice)}</Text>
          <Text style={styles.discountPrice}>{formatCents(offer.discountPrice)}</Text>
        </View>
        <Text style={styles.validUntil}>Válido até {formatDate(offer.endDate)}</Text>
        <View style={styles.buttonWrapper}>
          {deliveryOnly ? (
            <>
              <Pressable style={styles.deliveryButtonPrimary} onPress={() => router.push(`/pedido/${offer.slug}`)}>
                <Bike size={18} color={colors.white} />
                <Text style={styles.deliveryButtonPrimaryText}>Pedir com entrega</Text>
              </Pressable>
              <GenerateCouponButton offerId={offer.id} icon={<Ticket size={18} color={colors.green} />} variant="secondary" />
            </>
          ) : (
            <>
              <GenerateCouponButton offerId={offer.id} icon={<Ticket size={18} color={colors.white} />} />
              {hasDelivery && (
                <Pressable style={styles.deliveryButton} onPress={() => router.push(`/pedido/${offer.slug}`)}>
                  <Bike size={18} color={colors.green} />
                  <Text style={styles.deliveryButtonText}>Pedir com entrega</Text>
                </Pressable>
              )}
            </>
          )}
          <View style={styles.secondaryRow}>
            {offer.business.acceptsPickup && (
              <Pressable style={styles.secondaryButton} onPress={handleDirections}>
                <Navigation size={16} color={colors.neutral900} />
                <Text style={styles.secondaryText}>Como chegar</Text>
              </Pressable>
            )}
            <Pressable style={styles.secondaryButton} onPress={handleShare}>
              <Share2 size={16} color={colors.neutral900} />
              <Text style={styles.secondaryText}>Compartilhar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageWrapper: { width: '100%', height: 240 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', backgroundColor: colors.neutral100 },
  discountBadge: { position: 'absolute', left: 16, top: 56, backgroundColor: colors.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  discountText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  topBar: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBarRight: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  content: {
    padding: 16,
    gap: 8,
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.white,
  },
  business: { fontSize: 13, color: colors.neutral500 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  description: { fontSize: 14, color: colors.neutral500, lineHeight: 20 },
  priceRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline', marginTop: 8 },
  originalPrice: { fontSize: 14, color: colors.neutral400, textDecorationLine: 'line-through' },
  discountPrice: { fontSize: 24, fontWeight: '800', color: colors.green },
  validUntil: { fontSize: 12, color: colors.neutral500 },
  buttonWrapper: { marginTop: 16, gap: 10 },
  deliveryButton: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryButtonText: { color: colors.green, fontWeight: '700', fontSize: 14 },
  deliveryButtonPrimary: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryButtonPrimaryText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 12,
    paddingVertical: 11,
  },
  secondaryText: { fontSize: 13, fontWeight: '600', color: colors.neutral900 },
})
