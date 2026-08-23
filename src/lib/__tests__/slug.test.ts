import { describe, expect, it } from 'vitest'
import { slugify, randomSlugSuffix } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and hyphenates a simple name', () => {
    expect(slugify('Big Burger')).toBe('big-burger')
  })

  it('strips accents', () => {
    expect(slugify('Pão & Cia')).toBe('pao-cia')
  })

  it('collapses multiple spaces and dashes', () => {
    expect(slugify('Combo  Especial -- Família')).toBe('combo-especial-familia')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('  -Oferta Relâmpago-  ')).toBe('oferta-relampago')
  })
})

describe('randomSlugSuffix', () => {
  it('returns a lowercase alphanumeric string', () => {
    expect(randomSlugSuffix()).toMatch(/^[a-z0-9]+$/)
  })

  it('returns different values across calls', () => {
    const values = new Set(Array.from({ length: 30 }, () => randomSlugSuffix()))
    expect(values.size).toBeGreaterThan(1)
  })
})
