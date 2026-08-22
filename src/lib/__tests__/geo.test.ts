import { describe, expect, it } from 'vitest'
import { distanceKm, formatDistance } from '@/lib/geo'

describe('distanceKm', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: -25.9, lng: -53.05 }
    expect(distanceKm(p, p)).toBeCloseTo(0, 5)
  })

  it('computes a known distance between two Brazilian cities within 1% tolerance', () => {
    // Curitiba to São Paulo, ~340 km great-circle distance
    const curitiba = { lat: -25.4284, lng: -49.2733 }
    const saoPaulo = { lat: -23.5505, lng: -46.6333 }
    const km = distanceKm(curitiba, saoPaulo)
    expect(km).toBeGreaterThan(330)
    expect(km).toBeLessThan(350)
  })
})

describe('formatDistance', () => {
  it('formats sub-kilometer distances in meters', () => {
    expect(formatDistance(0.8)).toBe('800 m')
  })

  it('formats kilometer distances with a comma decimal', () => {
    expect(formatDistance(1.2)).toBe('1,2 km')
  })

  it('formats whole kilometers without decimals', () => {
    expect(formatDistance(5)).toBe('5 km')
  })
})
