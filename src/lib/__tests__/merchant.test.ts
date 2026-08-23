import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBusinessForOwner, getMyOffers, getOfferForOwner } from '@/lib/merchant'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findFirst: vi.fn() },
    offer: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))

describe('getBusinessForOwner', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries the business owned by the given user, including its category', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await getBusinessForOwner('user-1')

    expect(prisma.business.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      include: { category: true },
    })
    expect(result).toEqual({ id: 'biz-1' })
  })
})

describe('getMyOffers', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries all offers for the business ordered by newest first', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([{ id: 'offer-1' }] as never)

    const result = await getMyOffers('biz-1')

    expect(prisma.offer.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'offer-1' }])
  })
})

describe('getOfferForOwner', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('scopes the lookup to both the offer id and the business id', async () => {
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await getOfferForOwner('offer-1', 'biz-1')

    expect(prisma.offer.findFirst).toHaveBeenCalledWith({
      where: { id: 'offer-1', businessId: 'biz-1' },
    })
    expect(result).toEqual({ id: 'offer-1' })
  })
})
