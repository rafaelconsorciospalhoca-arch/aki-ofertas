import { Stack, router, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import { getStoredLocation } from '@/storage/location'

const queryClient = new QueryClient()

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getStoredLocation().then((location) => {
      const onOnboarding = segments[0] === 'onboarding'
      if (!location && !onOnboarding) {
        router.replace('/onboarding')
      }
      setChecked(true)
    })
  }, [segments])

  if (!checked) return null
  return <>{children}</>
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OnboardingGate>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </OnboardingGate>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
