import { Modal, View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { X } from 'lucide-react-native'
import { colors } from '@/theme/colors'
import { useCities } from '@/api/hooks/useCities'

export function CityPickerModal({
  visible,
  onClose,
  onSelectCity,
}: {
  visible: boolean
  onClose: () => void
  onSelectCity: (name: string, state: string) => void
}) {
  const cities = useCities()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Escolha sua cidade</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={20} color={colors.neutral900} />
            </Pressable>
          </View>
          {cities.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
          <FlatList
            data={cities.data ?? []}
            keyExtractor={(city) => city.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.cityRow} onPress={() => onSelectCity(item.name, item.state)}>
                <Text style={styles.cityText}>
                  {item.name} · {item.state}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral200,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.neutral900 },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20 },
  cityRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  cityText: { fontSize: 15, color: colors.neutral900 },
})
