import { describe, expect, it } from 'vitest'
import { getEffectiveCommissionPercent } from '@/lib/commission'

describe('getEffectiveCommissionPercent', () => {
  it('uses the category percent when the override is off', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: false,
      commissionOverridePercent: 99,
      category: { commissionPercent: 10 },
    })
    expect(result).toBe(10)
  })

  it('uses the override percent when the override is on', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: true,
      commissionOverridePercent: 15,
      category: { commissionPercent: 10 },
    })
    expect(result).toBe(15)
  })

  it('forces no commission when the override is on with a null percent, even if the category charges', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: true,
      commissionOverridePercent: null,
      category: { commissionPercent: 10 },
    })
    expect(result).toBeNull()
  })

  it('stays null when neither the override nor the category charges commission', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: false,
      commissionOverridePercent: null,
      category: { commissionPercent: null },
    })
    expect(result).toBeNull()
  })
})
