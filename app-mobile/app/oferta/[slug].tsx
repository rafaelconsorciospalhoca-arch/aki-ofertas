import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { useOfferDetail } from '@/api/hooks/useOfferDetail'
import { GenerateCouponButton } from '@/components/GenerateCouponButton'

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

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: offer.business.name }} />
      {offer.imageUrl ? (
        <Image source={{ uri: offer.imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}
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
          <GenerateCouponButton offerId={offer.id} />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 220 },
  imagePlaceholder: { width: '100%', height: 220, backgroundColor: colors.neutral100 },
  content: { padding: 16, gap: 8 },
  business: { fontSize: 13, color: colors.neutral500 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  description: { fontSize: 14, color: colors.neutral500, lineHeight: 20 },
  priceRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline', marginTop: 8 },
  originalPrice: { fontSize: 14, color: colors.neutral400, textDecorationLine: 'line-through' },
  discountPrice: { fontSize: 24, fontWeight: '800', color: colors.green },
  validUntil: { fontSize: 12, color: colors.neutral500 },
  buttonWrapper: { marginTop: 16 },
})
