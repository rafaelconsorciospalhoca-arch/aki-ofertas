import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCouponsForUser, getCouponForOffer, getCouponsCountForOffer } from '@/lib/coupons'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    coupon: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  },
}))

const now = new Date('2026-06-15T12:00:00Z')

function couponRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'coupon-1',
    code: 'AK7X9K2',
    status: 'GENERATED',
    generatedAt: new Date('2026-06-01'),
    usedAt: null,
    expiresAt: new Date('2026-07-01'),
    offerId: 'offer-1',
    offer: { title: 'Combo Burguer', slug: 'combo-burguer', customCouponCode: null },
    business: { name: 'Big Burger', slug: 'big-burger' },
    ...overrides,
  }
}

describe('getCouponsForUser', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('returns an empty list when the user has no coupons', async () => {
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([])
    const result = await getCouponsForUser('user-1')
    expect(result).toEqual([])
  })

  it('maps coupon rows and computes VALID status for an unused, unexpired coupon', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([couponRow()] as never)

    const result = await getCouponsForUser('user-1')

    expect(result).toEqual([
      {
        id: 'coupon-1',
        code: 'AK7X9K2',
        status: 'VALID',
        generatedAt: new Date('2026-06-01'),
        usedAt: null,
        expiresAt: new Date('2026-07-01'),
        offerId: 'offer-1',
        offerTitle: 'Combo Burguer',
        offerSlug: 'combo-burguer',
        businessName: 'Big Burger',
        businessSlug: 'big-burger',
      },
    ])
  })

  it('computes USED status when the coupon was used, even if not yet expired', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([
      couponRow({ status: 'USED', usedAt: new Date('2026-06-10') }),
    ] as never)

    const result = await getCouponsForUser('user-1')
    expect(result[0].status).toBe('USED')
  })

  it('computes EXPIRED status when expiresAt is in the past and the coupon was never used', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([
      couponRow({ expiresAt: new Date('2026-06-01') }),
    ] as never)

    const result = await getCouponsForUser('user-1')
    expect(result[0].status).toBe('EXPIRED')
  })

  it('shows the offer\'s custom coupon code instead of the internal one when set', async () => {
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([
      couponRow({ offer: { title: 'Combo Burguer', slug: 'combo-burguer', customCouponCode: 'LOJA10' } }),
    ] as never)

    const result = await getCouponsForUser('user-1')
    expect(result[0].code).toBe('LOJA10')
  })

  it('orders by generatedAt descending via the query', async () => {
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([])
    await getCouponsForUser('user-1')
    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' }, orderBy: { generatedAt: 'desc' } }),
    )
  })
})

describe('getCouponForOffer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no coupon exists', async () => {
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue(null)
    const result = await getCouponForOffer('user-1', 'offer-1')
    expect(result).toBeNull()
  })

  it('returns the mapped coupon when one exists', async () => {
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue(couponRow() as never)
    const result = await getCouponForOffer('user-1', 'offer-1')
    expect(result?.code).toBe('AK7X9K2')
    expect(prisma.coupon.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', offerId: 'offer-1' } }),
    )
  })
})

describe('getCouponsCountForOffer', () => {
  it('returns the count from prisma', async () => {
    vi.mocked(prisma.coupon.count).mockResolvedValue(3)
    const result = await getCouponsCountForOffer('offer-1')
    expect(result).toBe(3)
    expect(prisma.coupon.count).toHaveBeenCalledWith({ where: { offerId: 'offer-1' } })
  })
})
