import { describe, expect, it } from 'vitest'
import { reaisToCents, centsToReais } from '@/lib/money'

describe('reaisToCents', () => {
  it('converts a two-decimal value', () => {
    expect(reaisToCents('29.90')).toBe(2990)
  })

  it('pads a one-decimal value', () => {
    expect(reaisToCents('29.9')).toBe(2990)
  })

  it('treats a whole number as zero cents', () => {
    expect(reaisToCents('29')).toBe(2900)
  })

  it('handles small values correctly', () => {
    expect(reaisToCents('0.05')).toBe(5)
  })

  it('returns null for non-numeric input', () => {
    expect(reaisToCents('abc')).toBeNull()
  })

  it('returns null for a negative value', () => {
    expect(reaisToCents('-5')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(reaisToCents('')).toBeNull()
  })
})

describe('centsToReais', () => {
  it('formats cents back into a two-decimal string', () => {
    expect(centsToReais(2990)).toBe('29.90')
  })

  it('pads small values', () => {
    expect(centsToReais(5)).toBe('0.05')
  })

  it('round-trips through reaisToCents', () => {
    expect(reaisToCents(centsToReais(4290))).toBe(4290)
  })
})
