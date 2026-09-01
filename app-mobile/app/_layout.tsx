import { Stack, router, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import { LocationProvider, useLocation } from '@/location/LocationContext'

const queryClient = new QueryClient()

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const { location, loading } = useLocation()

  useEffect(() => {
    if (loading) return
    const onOnboarding = segments[0] === 'onboarding'
    if (!location && !onOnboarding) {
      router.replace('/onboarding')
    }
  }, [loading, location, segments])

  if (loading) return null
  return <>{children}</>
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <LocationProvider>
            <StatusBar style="light" />
            <OnboardingGate>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
            </OnboardingGate>
          </LocationProvider>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
