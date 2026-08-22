import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFeaturedOffers, getOffersList, getOfferBySlug, toOfferListItem } from '@/lib/offers'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    offer: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

const bigBurger = { id: 'biz-1', name: 'Big Burger', slug: 'big-burger', city: 'Marmeleiro', state: 'PR', lat: -25.9006, lng: -53.0489 }
const farBusiness = { id: 'biz-2', name: 'Distant Pizza', slug: 'distant-pizza', city: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733 }

const nearOffer = {
  id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', imageUrl: null,
  originalPrice: 4290, discountPrice: 2990, discountPercent: 30, createdAt: new Date('2026-01-01'),
  business: bigBurger,
}
const farOffer = {
  id: 'offer-2', slug: 'pizza-grande', title: 'Pizza Grande', imageUrl: null,
  originalPrice: 5990, discountPrice: 4490, discountPercent: 25, createdAt: new Date('2026-01-02'),
  business: farBusiness,
}

describe('toOfferListItem', () => {
  it('computes distance and label when a location is given', () => {
    const item = toOfferListItem(nearOffer, bigBurger, { lat: -25.9006, lng: -53.0489 })
    expect(item.distanceKm).toBeCloseTo(0, 5)
    expect(item.distanceLabel).toBe('0 m')
  })

  it('leaves distance null when no location is given', () => {
    const item = toOfferListItem(nearOffer, bigBurger, null)
    expect(item.distanceKm).toBeNull()
    expect(item.distanceLabel).toBeNull()
  })

  it('maps business name and slug onto the item', () => {
    const item = toOfferListItem(nearOffer, bigBurger, null)
    expect(item.businessName).toBe('Big Burger')
    expect(item.businessSlug).toBe('big-burger')
  })
})

describe('getFeaturedOffers', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sorts by distance ascending when a location is given', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getFeaturedOffers({ location: { lat: -25.9006, lng: -53.0489 }, limit: 10 })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer', 'pizza-grande'])
  })

  it('queries only ACTIVE offers ordered by createdAt desc when there is no location', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
    )
    expect(result.map((o) => o.slug)).toEqual(['pizza-grande', 'combo-burguer'])
    expect(result[0].distanceKm).toBeNull()
  })

  it('respects the limit', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 1 })

    expect(result).toHaveLength(1)
  })
})

describe('getOffersList', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('passes categoryId through to the where clause when given', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([] as never)

    await getOffersList({ categoryId: 'cat-1', location: null })

    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', categoryId: 'cat-1' },
      }),
    )
  })

  it('filters out offers beyond radiusKm when a location and radius are given', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getOffersList({
      location: { lat: -25.9006, lng: -53.0489 },
      radiusKm: 5,
    })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer'])
  })

  it('keeps all offers when no radius is given, sorted by distance', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getOffersList({ location: { lat: -25.9006, lng: -53.0489 } })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer', 'pizza-grande'])
  })

  it('applies radiusKm: 0 as a real filter instead of disabling filtering (only exact-location matches survive)', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getOffersList({
      location: { lat: -25.9006, lng: -53.0489 },
      radiusKm: 0,
    })

    // nearOffer's business sits at the exact same coordinates as the search
    // location, so its distance is exactly 0km, which satisfies `<= 0`.
    // farOffer is filtered out. This proves radiusKm: 0 is no longer treated
    // as "no filter" (the previous truthiness-check bug).
    expect(result.map((o) => o.slug)).toEqual(['combo-burguer'])
  })
})

describe('getOfferBySlug', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no offer matches', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue(null as never)

    const result = await getOfferBySlug('does-not-exist')

    expect(result).toBeNull()
  })

  it('maps the offer and its business when found', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', description: 'Pão, carne e queijo.',
      imageUrl: null, originalPrice: 4290, discountPrice: 2990, discountPercent: 30,
      quantityAvailable: null, startDate: new Date('2026-01-01'), endDate: new Date('2026-02-01'),
      business: { name: 'Big Burger', slug: 'big-burger', whatsapp: '5546999990000', city: 'Marmeleiro', state: 'PR' },
    } as never)

    const result = await getOfferBySlug('combo-burguer')

    expect(result).not.toBeNull()
    expect(result?.title).toBe('Combo Burguer')
    expect(result?.business.name).toBe('Big Burger')
    expect(prisma.offer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'combo-burguer' } }),
    )
  })
})
