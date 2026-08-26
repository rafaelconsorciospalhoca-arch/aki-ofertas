import { describe, expect, it } from 'vitest'
import { generateSessionToken, hashSessionToken, addDays } from '@/lib/mobile-auth'

describe('generateSessionToken', () => {
  it('generates a 64-character hex string', () => {
    const token = generateSessionToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates different tokens across calls', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken())
  })
})

describe('hashSessionToken', () => {
  it('is deterministic for the same input', () => {
    const token = generateSessionToken()
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
  })

  it('produces different hashes for different tokens', () => {
    expect(hashSessionToken(generateSessionToken())).not.toBe(hashSessionToken(generateSessionToken()))
  })
})

describe('addDays', () => {
  it('adds the given number of days', () => {
    const result = addDays(new Date('2026-01-01T00:00:00Z'), 60)
    expect(result).toEqual(new Date('2026-03-02T00:00:00Z'))
  })
})
