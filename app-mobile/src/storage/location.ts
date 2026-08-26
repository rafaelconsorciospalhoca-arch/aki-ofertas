// app-mobile/src/storage/location.ts
import * as kv from '@/storage/kv'

const LOCATION_KEY = 'aki_location'

export type StoredLocation =
  | { type: 'gps'; lat: number; lng: number }
  | { type: 'city'; name: string; state: string }

export async function getStoredLocation(): Promise<StoredLocation | null> {
  const raw = await kv.getItemAsync(LOCATION_KEY)
  return raw ? (JSON.parse(raw) as StoredLocation) : null
}

export async function setStoredLocation(location: StoredLocation): Promise<void> {
  await kv.setItemAsync(LOCATION_KEY, JSON.stringify(location))
}
