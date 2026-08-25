import { describe, expect, it } from 'vitest'
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
  generateSessionToken,
  hashSessionToken,
  addDays,
  addMinutes,
} from '@/lib/mobile-auth'

describe('generateOtpCode', () => {
  it('generates a 6-digit numeric string', () => {
    const code = generateOtpCode()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('generates different codes across calls (not hardcoded)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('hashOtpCode / verifyOtpCode', () => {
  it('verifies a matching code', async () => {
    const hash = await hashOtpCode('123456')
    expect(await verifyOtpCode('123456', hash)).toBe(true)
  })

  it('rejects a non-matching code', async () => {
    const hash = await hashOtpCode('123456')
    expect(await verifyOtpCode('654321', hash)).toBe(false)
  })

  it('never stores the code in plain text', async () => {
    const hash = await hashOtpCode('123456')
    expect(hash).not.toBe('123456')
  })
})

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

describe('addMinutes', () => {
  it('adds the given number of minutes', () => {
    const result = addMinutes(new Date('2026-01-01T00:00:00Z'), 5)
    expect(result).toEqual(new Date('2026-01-01T00:05:00Z'))
  })
})
