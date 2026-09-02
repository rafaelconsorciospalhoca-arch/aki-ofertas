import { Stack, router, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import { LocationProvider, useLocation } from '@/location/LocationContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // React Query's default staleTime is 0, so every single screen mount
      // (including navigating back to a screen you just left) re-fetches
      // and shows a loading spinner even when the data is seconds old —
      // that's what read as "the app is slow to open offers/pages" on a
      // real device (no cold network involved, just needless refetches).
      // 60s keeps data "fresh" long enough that normal back-and-forth
      // navigation is instant, while still refetching on a real revisit.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
})

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
              <ErrorBoundary>
                <Stack screenOptions={{ headerBackTitle: '' }}>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
              </ErrorBoundary>
            </OnboardingGate>
          </LocationProvider>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
