import { Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Heart } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useFavorites, useToggleFavorite, type FavoriteTarget } from '@/api/hooks/useFavorites'

export function HeartButton({
  target,
  size = 20,
  variant = 'overlay',
}: {
  target: FavoriteTarget
  size?: number
  variant?: 'overlay' | 'plain'
}) {
  const { token } = useAuth()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()

  const favorited = Boolean(
    favorites.data &&
      (target.offerId
        ? favorites.data.offers.some((o) => o.id === target.offerId)
        : favorites.data.businesses.some((b) => b.id === target.businessId)),
  )

  function handlePress() {
    if (!token) {
      router.push('/entrar')
      return
    }
    toggle.mutate(target)
  }

  return (
    <Pressable
      style={variant === 'overlay' ? styles.overlay : styles.plain}
      onPress={handlePress}
      disabled={toggle.isPending}
    >
      <Heart size={size} color={favorited ? colors.red : colors.neutral900} fill={favorited ? colors.red : 'transparent'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  overlay: {
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
  plain: { padding: 4 },
})
