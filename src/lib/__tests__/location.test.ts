import { describe, expect, it } from 'vitest'
import { parseGeoCookie, serializeGeoCookie } from '@/lib/location'

describe('parseGeoCookie', () => {
  it('parses a valid "lat,lng" string', () => {
    expect(parseGeoCookie('-25.9006,-53.0489')).toEqual({ lat: -25.9006, lng: -53.0489 })
  })

  it('returns null for undefined', () => {
    expect(parseGeoCookie(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(parseGeoCookie(null)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseGeoCookie('')).toBeNull()
  })

  it('returns null for a malformed value', () => {
    expect(parseGeoCookie('not-a-coordinate')).toBeNull()
  })
})

describe('serializeGeoCookie', () => {
  it('round-trips through parseGeoCookie', () => {
    const coords = { lat: -25.4284, lng: -49.2733 }
    expect(parseGeoCookie(serializeGeoCookie(coords))).toEqual(coords)
  })
})
