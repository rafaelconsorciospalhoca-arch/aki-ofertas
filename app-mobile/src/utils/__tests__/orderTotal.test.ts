import { describe, expect, it } from '@jest/globals'
import { calculateOrderTotal } from '@/utils/orderTotal'

describe('calculateOrderTotal', () => {
  it('adds the delivery fee to the subtotal', () => {
    expect(calculateOrderTotal(9990, 500)).toBe(10490)
  })

  it('treats a null fee as zero', () => {
    expect(calculateOrderTotal(9990, null)).toBe(9990)
  })
})
