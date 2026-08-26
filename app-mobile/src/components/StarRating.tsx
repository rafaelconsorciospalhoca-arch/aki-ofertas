import { View, Pressable, StyleSheet } from 'react-native'
import { Star } from 'lucide-react-native'
import { colors } from '@/theme/colors'

export function StarRating({
  rating,
  size = 16,
  onChange,
}: {
  rating: number
  size?: number
  onChange?: (value: number) => void
}) {
  const stars = [1, 2, 3, 4, 5]

  return (
    <View style={styles.row}>
      {stars.map((value) => {
        const filled = value <= Math.round(rating)
        const star = (
          <Star size={size} color={colors.amber} fill={filled ? colors.amber : 'transparent'} />
        )
        if (!onChange) {
          return <View key={value}>{star}</View>
        }
        return (
          <Pressable key={value} onPress={() => onChange(value)} hitSlop={4}>
            {star}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
})
