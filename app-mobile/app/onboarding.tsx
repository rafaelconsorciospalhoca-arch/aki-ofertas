import { useState } from 'react'
import { View, Text, Image, StyleSheet, ActivityIndicator, Pressable, FlatList } from 'react-native'
import * as Location from 'expo-location'
import { router, Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { useLocation } from '@/location/LocationContext'
import { useCities } from '@/api/hooks/useCities'
import { apiFetch } from '@/api/client'

export default function OnboardingScreen() {
  const [requesting, setRequesting] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const cities = useCities()
  const { setLocation } = useLocation()

  async function handleAllowLocation() {
    setRequesting(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setShowCityPicker(true)
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      const lat = position.coords.latitude
      const lng = position.coords.longitude

      // Best-effort: a friendly city name is nicer than "Perto de você", but
      // the app works fine with just coordinates if this lookup fails.
      let cityLabel: string | undefined
      try {
        const resolved = await apiFetch<{ city: string; state: string }>(`/geocode/reverso?lat=${lat}&lng=${lng}`)
        cityLabel = `${resolved.city} - ${resolved.state}`
      } catch {
        cityLabel = undefined
      }

      await setLocation({ type: 'gps', lat, lng, cityLabel })
      router.replace('/(tabs)')
    } finally {
      setRequesting(false)
    }
  }

  async function handleSelectCity(name: string, state: string) {
    await setLocation({ type: 'city', name, state })
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
      <View style={styles.brandArea}>
        <Image source={require('../assets/brand/logo.png')} style={styles.logoImage} />
        <Text style={styles.logo}>
          Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
        </Text>
        <Text style={styles.subtitle}>As melhores ofertas, pertinho de você!</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Permita sua localização</Text>
        <Text style={styles.cardText}>
          Assim podemos mostrar as melhores ofertas e estabelecimentos perto de você.
        </Text>
        <Pressable style={styles.primaryButton} onPress={handleAllowLocation} disabled={requesting}>
          {requesting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Ativar localização</Text>
          )}
        </Pressable>
        <Pressable onPress={() => setShowCityPicker(true)}>
          <Text style={styles.linkText}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.navy, paddingVertical: 64 },
  brandArea: { alignItems: 'center', gap: 4 },
  logoImage: { width: 88, height: 88, borderRadius: 20, marginBottom: 16 },
  logo: { fontSize: 26, fontWeight: '800', color: colors.white },
  subtitle: { fontSize: 13, color: colors.neutral200, textAlign: 'center', marginTop: 4 },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.neutral900 },
  cardText: { fontSize: 13, color: colors.neutral500, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  primaryButton: {
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.neutral400, fontSize: 13 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, marginTop: 48 },
  cityRow: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  cityText: { fontSize: 15 },
})
