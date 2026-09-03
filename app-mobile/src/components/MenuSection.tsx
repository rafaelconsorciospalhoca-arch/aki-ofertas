import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { optimizedImageUrl } from '@/utils/optimizedImageUrl'
import { useMenu } from '@/api/hooks/useMenu'

export function MenuSection({ slug }: { slug: string }) {
  const menu = useMenu(slug)

  if (menu.isLoading) {
    return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />
  }

  if (!menu.data || menu.data.length === 0) {
    return <Text style={styles.emptyText}>Este estabelecimento ainda não cadastrou o cardápio.</Text>
  }

  return (
    <View style={styles.container}>
      {menu.data.map((item) => (
        <View key={item.id} style={styles.row}>
          {item.imageUrl ? (
            <Image
              source={{ uri: optimizedImageUrl(item.imageUrl, 150) }}
              style={styles.image}
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <View style={styles.imagePlaceholder} />
          )}
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            {item.description && <Text style={styles.description}>{item.description}</Text>}
          </View>
          {item.price !== null && <Text style={styles.price}>{formatCents(item.price)}</Text>}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginTop: 12, gap: 14 },
  emptyText: { fontSize: 13, color: colors.neutral400, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  image: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.neutral100 },
  imagePlaceholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.neutral100 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  description: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '700', color: colors.green },
})
