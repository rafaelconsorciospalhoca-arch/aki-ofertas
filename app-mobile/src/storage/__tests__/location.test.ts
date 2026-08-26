// app-mobile/src/storage/__tests__/location.test.ts
import { describe, expect, it, jest, afterEach } from '@jest/globals'
import * as SecureStore from 'expo-secure-store'
import { getStoredLocation, setStoredLocation } from '@/storage/location'

jest.mock('expo-secure-store')

describe('getStoredLocation', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when nothing is stored', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
    const result = await getStoredLocation()
    expect(result).toBeNull()
  })

  it('parses a stored GPS location', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ type: 'gps', lat: -25.9, lng: -53.05 }),
    )
    const result = await getStoredLocation()
    expect(result).toEqual({ type: 'gps', lat: -25.9, lng: -53.05 })
  })

  it('parses a stored manual city', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ type: 'city', name: 'Marmeleiro', state: 'PR' }),
    )
    const result = await getStoredLocation()
    expect(result).toEqual({ type: 'city', name: 'Marmeleiro', state: 'PR' })
  })
})

describe('setStoredLocation', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('stores the location as JSON', async () => {
    await setStoredLocation({ type: 'city', name: 'Marmeleiro', state: 'PR' })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'aki_location',
      JSON.stringify({ type: 'city', name: 'Marmeleiro', state: 'PR' }),
    )
  })
})
