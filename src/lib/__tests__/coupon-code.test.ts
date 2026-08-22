import { describe, expect, it } from 'vitest'
import { generateCouponCode } from '@/lib/coupon-code'

describe('generateCouponCode', () => {
  it('starts with AK', () => {
    expect(generateCouponCode().startsWith('AK')).toBe(true)
  })

  it('is 8 characters long', () => {
    expect(generateCouponCode()).toHaveLength(8)
  })

  it('only contains uppercase letters and digits after the prefix', () => {
    const code = generateCouponCode()
    expect(code.slice(2)).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('generates different codes across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCouponCode()))
    expect(codes.size).toBe(50)
  })
})
