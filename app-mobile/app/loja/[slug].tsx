import { useState } from 'react'
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, Share, Linking } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { ArrowLeft, Share2, Phone, MessageCircle } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { HeartButton } from '@/components/HeartButton'
import { StarRating } from '@/components/StarRating'
import { ReviewsSection } from '@/components/ReviewsSection'
import { MenuSection } from '@/components/MenuSection'
import { optimizedImageUrl } from '@/utils/optimizedImageUrl'
import { useBusinessDetail } from '@/api/hooks/useBusinessDetail'
import { useReviews } from '@/api/hooks/useReviews'

type Tab = 'sobre' | 'ofertas' | 'cardapio' | 'avaliacoes'
const TABS: { key: Tab; label: string }[] = [
  { key: 'sobre', label: 'Sobre' },
  { key: 'ofertas', label: 'Ofertas' },
  { key: 'cardapio', label: 'Cardápio' },
  { key: 'avaliacoes', label: 'Avaliações' },
]

export default function LojaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: business, isLoading } = useBusinessDetail(slug)
  const reviews = useReviews(slug)
  const [tab, setTab] = useState<Tab>('ofertas')

  if (isLoading || !business) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  function handleShare() {
    Share.share({ message: `${business!.name} no Aki Ofertas` })
  }

  function handleCall() {
    if (business!.phone) Linking.openURL(`tel:${business!.phone}`)
  }

  function handleMessage() {
    if (business!.whatsapp) Linking.openURL(`https://wa.me/${business!.whatsapp.replace(/\D/g, '')}`)
  }

  const header = (
    <View>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.coverWrapper}>
        {business.coverUrl ? (
          <Image
            source={{ uri: optimizedImageUrl(business.coverUrl, 800) }}
            style={styles.cover}
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.neutral900} />
          </Pressable>
          <View style={styles.topBarRight}>
            <HeartButton target={{ businessId: business.id }} />
            <Pressable style={styles.iconButton} onPress={handleShare}>
              <Share2 size={18} color={colors.neutral900} />
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.header}>
        <Text style={styles.name}>{business.name}</Text>
        <Text style={styles.category}>{business.categoryName}</Text>
        <Text style={styles.location}>{business.city} · {business.state}</Text>
        {reviews.data && reviews.data.count > 0 && (
          <View style={styles.ratingRow}>
            <StarRating rating={reviews.data.average ?? 0} size={14} />
            <Text style={styles.ratingText}>
              {reviews.data.average!.toFixed(1)} ({reviews.data.count})
            </Text>
          </View>
        )}

        {(business.phone || business.whatsapp) && (
          <View style={styles.ctaColumn}>
            {business.phone && (
              <Pressable style={styles.primaryButton} onPress={handleCall}>
                <Phone size={18} color={colors.white} />
                <Text style={styles.primaryButtonText}>Ver telefone</Text>
              </Pressable>
            )}
            <View style={styles.secondaryRow}>
              {business.whatsapp && (
                <Pressable style={styles.secondaryButton} onPress={handleMessage}>
                  <MessageCircle size={16} color={colors.neutral900} />
                  <Text style={styles.secondaryText}>Mensagem</Text>
                </Pressable>
              )}
              <Pressable style={styles.secondaryButton} onPress={handleShare}>
                <Share2 size={16} color={colors.neutral900} />
                <Text style={styles.secondaryText}>Compartilhar</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.tabRow}>
          {TABS.map((t) => (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              {tab === t.key && <View style={styles.tabIndicator} />}
            </Pressable>
          ))}
        </View>

        {tab === 'sobre' && (
          <Text style={styles.description}>{business.description || 'Este estabelecimento ainda não adicionou uma descrição.'}</Text>
        )}
        {tab === 'cardapio' && <MenuSection slug={business.slug} />}
        {tab === 'avaliacoes' && <ReviewsSection slug={business.slug} />}
        {tab === 'ofertas' && <Text style={styles.offersTitle}>Ofertas do dia</Text>}
      </View>
    </View>
  )

  return (
    <FlatList
      data={tab === 'ofertas' ? business.offers : []}
      keyExtractor={(offer) => offer.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <OfferCard offer={item} />
        </View>
      )}
      ListEmptyComponent={
        tab === 'ofertas' ? <Text style={styles.emptyText}>Nenhuma oferta ativa no momento.</Text> : null
      }
    />
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 24 },
  coverWrapper: { width: '100%', height: 160 },
  cover: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.neutral100 },
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
  header: {
    padding: 16,
    gap: 4,
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.white,
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  category: { fontSize: 13, color: colors.green, fontWeight: '600' },
  location: { fontSize: 13, color: colors.neutral500 },
  description: { fontSize: 14, color: colors.neutral500, marginTop: 12, lineHeight: 20 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ratingText: { fontSize: 12, color: colors.neutral500, fontWeight: '600' },
  ctaColumn: { marginTop: 16, gap: 10 },
  primaryButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
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
  tabRow: { flexDirection: 'row', marginTop: 20, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  tab: { marginRight: 20, paddingBottom: 10, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.neutral400 },
  tabTextActive: { color: colors.green },
  tabIndicator: { height: 2, backgroundColor: colors.green, borderRadius: 1, marginTop: 6, width: '100%' },
  offersTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, color: colors.neutral900 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 16, paddingHorizontal: 16 },
})
