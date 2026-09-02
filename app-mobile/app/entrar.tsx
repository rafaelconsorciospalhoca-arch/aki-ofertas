// app-mobile/app/entrar.tsx
//
// TEMPORARY DIAGNOSTIC STUB — the real login screen is crashing on real iOS
// devices (blank white screen, opens/closes) even with Apple Sign-In removed
// and an error boundary in place (which never shows anything, ruling out a
// catchable JS render error). This stub keeps only the Stack.Screen modal
// config and renders plain text, to find out whether the crash is in the
// modal navigation itself or in something this screen used to import.
import { View, Text, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { colors } from '@/theme/colors'

export default function EntrarScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <Text style={styles.text}>Tela de login (teste)</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontSize: 18, fontWeight: '700' },
})
