import { describe, expect, it } from 'vitest'
import { parseGeoCookie, serializeGeoCookie, parseCityCookie, serializeCityCookie } from '@/lib/location'

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

describe('parseCityCookie', () => {
  it('parses a valid "name|state" string', () => {
    expect(parseCityCookie('Marmeleiro|PR')).toEqual({ name: 'Marmeleiro', state: 'PR' })
  })

  it('returns null for undefined', () => {
    expect(parseCityCookie(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(parseCityCookie(null)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseCityCookie('')).toBeNull()
  })

  it('returns null for a malformed value with no separator', () => {
    expect(parseCityCookie('Marmeleiro')).toBeNull()
  })

  it('returns null for a malformed value with an empty half', () => {
    expect(parseCityCookie('Marmeleiro|')).toBeNull()
  })
})

describe('serializeCityCookie', () => {
  it('round-trips through parseCityCookie', () => {
    const city = { name: 'Curitiba', state: 'PR' }
    expect(parseCityCookie(serializeCityCookie(city))).toEqual(city)
  })
})
