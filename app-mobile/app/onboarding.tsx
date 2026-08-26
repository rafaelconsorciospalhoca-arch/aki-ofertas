import { useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Pressable, FlatList } from 'react-native'
import * as Location from 'expo-location'
import { router, Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { setStoredLocation } from '@/storage/location'
import { useCities } from '@/api/hooks/useCities'

export default function OnboardingScreen() {
  const [requesting, setRequesting] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const cities = useCities()

  async function handleAllowLocation() {
    setRequesting(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setShowCityPicker(true)
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      await setStoredLocation({
        type: 'gps',
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      })
      router.replace('/(tabs)')
    } finally {
      setRequesting(false)
    }
  }

  async function handleSelectCity(name: string, state: string) {
    await setStoredLocation({ type: 'city', name, state })
    router.replace('/(tabs)')
  }

  if (showCityPicker) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.title}>Escolha sua cidade</Text>
        {cities.isLoading && <ActivityIndicator color={colors.green} />}
        <FlatList
          data={cities.data ?? []}
          keyExtractor={(city) => city.id}
          renderItem={({ item }) => (
            <Pressable style={styles.cityRow} onPress={() => handleSelectCity(item.name, item.state)}>
              <Text style={styles.cityText}>
                {item.name} · {item.state}
              </Text>
            </Pressable>
          )}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.logo}>
        Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
      </Text>
      <Text style={styles.subtitle}>Ofertas de comércios pertinho de você</Text>
      <Pressable style={styles.primaryButton} onPress={handleAllowLocation} disabled={requesting}>
        {requesting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Permitir localização</Text>
        )}
      </Pressable>
      <Pressable onPress={() => setShowCityPicker(true)}>
        <Text style={styles.linkText}>Escolher cidade manualmente</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.navy },
  logo: { fontSize: 28, fontWeight: '800', color: colors.white, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.neutral200, marginBottom: 32, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.green,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 240,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.neutral200, fontSize: 13, textDecorationLine: 'underline' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, marginTop: 48 },
  cityRow: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  cityText: { fontSize: 15 },
})
