import { useEffect, useRef, useState } from 'react'
import { View, FlatList, useWindowDimensions, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { colors } from '@/theme/colors'
import { FeaturedOfferCard } from '@/components/FeaturedOfferCard'
import type { OfferListItem } from '@/api/types'

const SIDE_PADDING = 16
const AUTO_ADVANCE_MS = 5000

export function FeaturedCarousel({ offers }: { offers: OfferListItem[] }) {
  // `useWindowDimensions` (reactive) instead of a module-level `Dimensions.get('window')`
  // snapshot — on web the static snapshot can be taken before the real viewport settles,
  // producing a too-narrow card that both crops the offer image harder than intended and
  // lets the "OFERTA ESPECIAL" tag collide with the discount badge.
  const { width: windowWidth } = useWindowDimensions()
  const CARD_WIDTH = windowWidth - SIDE_PADDING * 2
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList<OfferListItem>>(null)

  useEffect(() => {
    if (offers.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % offers.length
        listRef.current?.scrollToIndex({ index: next, animated: true })
        return next
      })
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [offers.length])

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH)
    setIndex(next)
  }

  if (offers.length === 0) return null

  return (
    <View>
      <FlatList
        ref={listRef}
        data={offers}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(offer) => offer.id}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_, i) => ({ length: CARD_WIDTH, offset: CARD_WIDTH * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width: CARD_WIDTH }}>
            <FeaturedOfferCard offer={item} />
          </View>
        )}
      />
      {offers.length > 1 && (
        <View style={styles.dots}>
          {offers.map((offer, i) => (
            <View key={offer.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.neutral200 },
  dotActive: { backgroundColor: colors.green, width: 16 },
})
