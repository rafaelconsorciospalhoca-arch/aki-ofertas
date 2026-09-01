import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getStoredLocation, setStoredLocation, type StoredLocation } from '@/storage/location'

type LocationContextValue = {
  location: StoredLocation | null
  loading: boolean
  setLocation: (location: StoredLocation) => Promise<void>
}

const LocationContext = createContext<LocationContextValue | null>(null)

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocationState] = useState<StoredLocation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStoredLocation().then((stored) => {
      setLocationState(stored)
      setLoading(false)
    })
  }, [])

  const setLocation = useCallback(async (next: StoredLocation) => {
    await setStoredLocation(next)
    setLocationState(next)
  }, [])

  return <LocationContext.Provider value={{ location, loading, setLocation }}>{children}</LocationContext.Provider>
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) {
    throw new Error('useLocation must be used within LocationProvider')
  }
  return ctx
}
