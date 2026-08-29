import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFeaturedOffers, getOffersList, getOfferBySlug, toOfferListItem } from '@/lib/offers'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    offer: { findMany: vi.fn(), findUnique: vi.fn() },
    review: { groupBy: vi.fn().mockResolvedValue([]) },
  },
}))

const bigBurger = { id: 'biz-1', name: 'Big Burger', slug: 'big-burger', city: 'Marmeleiro', state: 'PR', lat: -25.9006, lng: -53.0489, status: 'ACTIVE', owner: { blocked: false }, serviceCities: [{ name: 'Marmeleiro', state: 'PR' }] }
const farBusiness = { id: 'biz-2', name: 'Distant Pizza', slug: 'distant-pizza', city: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733, status: 'ACTIVE', owner: { blocked: false }, serviceCities: [{ name: 'Curitiba', state: 'PR' }] }
const pendingBusiness = { id: 'biz-3', name: 'Pending Sushi', slug: 'pending-sushi', city: 'Marmeleiro', state: 'PR', lat: -25.9006, lng: -53.0489, status: 'PENDING', owner: { blocked: false }, serviceCities: [{ name: 'Marmeleiro', state: 'PR' }] }
const blockedOwnerBusiness = { id: 'biz-4', name: 'Blocked Bakery', slug: 'blocked-bakery', city: 'Marmeleiro', state: 'PR', lat: -25.9006, lng: -53.0489, status: 'ACTIVE', owner: { blocked: true }, serviceCities: [{ name: 'Marmeleiro', state: 'PR' }] }

const nearOffer = {
  id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', imageUrl: null,
  originalPrice: 4290, discountPrice: 2990, discountPercent: 30, createdAt: new Date('2026-01-01'),
  startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
  business: bigBurger,
}
const farOffer = {
  id: 'offer-2', slug: 'pizza-grande', title: 'Pizza Grande', imageUrl: null,
  originalPrice: 5990, discountPrice: 4490, discountPercent: 25, createdAt: new Date('2026-01-02'),
  startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
  business: farBusiness,
}
const pendingOffer = {
  id: 'offer-3', slug: 'sushi-combo', title: 'Combo Sushi', imageUrl: null,
  originalPrice: 6990, discountPrice: 4990, discountPercent: 28, createdAt: new Date('2026-01-03'),
  startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
  business: pendingBusiness,
}
const blockedOwnerOffer = {
  id: 'offer-4', slug: 'blocked-bakery-combo', title: 'Combo Padaria', imageUrl: null,
  originalPrice: 3990, discountPrice: 2990, discountPercent: 25, createdAt: new Date('2026-01-04'),
  startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
  business: blockedOwnerBusiness,
}

const proBusiness = { ...bigBurger, id: 'biz-5', slug: 'pro-business', plan: { priceCents: 19990 } }
const freeBusiness = { ...farBusiness, id: 'biz-6', slug: 'free-business', plan: null }
const proOffer = {
  id: 'offer-5', slug: 'oferta-pro', title: 'Oferta Pro', imageUrl: null,
  originalPrice: 2000, discountPrice: 1500, discountPercent: 25, createdAt: new Date('2026-01-05'),
  startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
  business: proBusiness,
}
const freeOffer = {
  id: 'offer-6', slug: 'oferta-free', title: 'Oferta Free', imageUrl: null,
  originalPrice: 2000, discountPrice: 1500, discountPercent: 25, createdAt: new Date('2026-01-06'),
  startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
  business: freeBusiness,
}

const allOffers = [nearOffer, farOffer, pendingOffer, blockedOwnerOffer]

// Simulates Prisma applying the `where` clause server-side, so tests can prove
// the query actually excludes non-ACTIVE businesses / blocked owners / non-matching
// cities end-to-end.
function fakeFindMany(args: {
  where: {
    business: {
      status: string
      owner?: { blocked: boolean }
      serviceCities?: { some: { name: string; state: string } }
    }
  }
}) {
  const { where } = args
  return Promise.resolve(
    allOffers.filter((offer) => {
      if (offer.business.status !== where.business.status) return false
      if (where.business.owner && offer.business.owner.blocked !== where.business.owner.blocked) return false
      if (where.business.serviceCities) {
        const { name, state } = where.business.serviceCities.some
        if (!offer.business.serviceCities.some((c) => c.name === name && c.state === state)) return false
      }
      return true
    }),
  )
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

  it('orders by the business plan price, highest first, regardless of location', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([freeOffer, proOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(result.map((o) => o.id)).toEqual(['offer-5', 'offer-6'])
  })

  it('treats a business with no plan as the lowest priority', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([proOffer, freeOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(result.map((o) => o.id)).toEqual(['offer-5', 'offer-6'])
  })

  it('attaches the business rating from getRatingsForBusinesses', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([nearOffer] as never)
    vi.mocked(prisma.review.groupBy).mockResolvedValue([
      { businessId: 'biz-1', _avg: { rating: 4.5 }, _count: 3 },
    ] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(result[0].rating).toEqual({ average: 4.5, count: 3 })
  })

  it('queries only ACTIVE offers ordered by createdAt desc when there is no location', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          business: { status: 'ACTIVE', owner: { blocked: false } },
          startDate: expect.objectContaining({ lte: expect.any(Date) }),
          endDate: expect.objectContaining({ gte: expect.any(Date) }),
        },
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

  it('excludes offers whose business is not ACTIVE, even though the offer itself is ACTIVE', async () => {
    vi.mocked(prisma.offer.findMany).mockImplementation(fakeFindMany as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(result.map((o) => o.slug)).not.toContain('sushi-combo')
    expect(result.map((o) => o.slug).sort()).toEqual(['combo-burguer', 'pizza-grande'])
  })

  it('filters to the given city when city is provided', async () => {
    vi.mocked(prisma.offer.findMany).mockImplementation(fakeFindMany as never)

    const result = await getFeaturedOffers({ location: null, city: { name: 'Marmeleiro', state: 'PR' }, limit: 10 })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer'])
  })

  it('excludes offers whose business owner is blocked, even though the business is ACTIVE', async () => {
    vi.mocked(prisma.offer.findMany).mockImplementation(fakeFindMany as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(result.map((o) => o.slug)).not.toContain('blocked-bakery-combo')
    expect(result.map((o) => o.slug).sort()).toEqual(['combo-burguer', 'pizza-grande'])
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
        where: {
          status: 'ACTIVE',
          categoryId: 'cat-1',
          business: { status: 'ACTIVE', owner: { blocked: false } },
          startDate: expect.objectContaining({ lte: expect.any(Date) }),
          endDate: expect.objectContaining({ gte: expect.any(Date) }),
        },
      }),
    )
  })

  it('passes query through as a case-insensitive title filter when given', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([] as never)

    await getOffersList({ location: null, query: 'burguer' })

    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: 'burguer', mode: 'insensitive' },
        }),
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

  it('excludes offers whose business is not ACTIVE, even though the offer itself is ACTIVE', async () => {
    vi.mocked(prisma.offer.findMany).mockImplementation(fakeFindMany as never)

    const result = await getOffersList({ location: null })

    expect(result.map((o) => o.slug)).not.toContain('sushi-combo')
    expect(result.map((o) => o.slug).sort()).toEqual(['combo-burguer', 'pizza-grande'])
  })

  it('filters to the given city when city is provided', async () => {
    vi.mocked(prisma.offer.findMany).mockImplementation(fakeFindMany as never)

    const result = await getOffersList({ location: null, city: { name: 'Marmeleiro', state: 'PR' } })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer'])
  })

  it('excludes offers whose business owner is blocked, even though the business is ACTIVE', async () => {
    vi.mocked(prisma.offer.findMany).mockImplementation(fakeFindMany as never)

    const result = await getOffersList({ location: null })

    expect(result.map((o) => o.slug)).not.toContain('blocked-bakery-combo')
    expect(result.map((o) => o.slug).sort()).toEqual(['combo-burguer', 'pizza-grande'])
  })

  it('excludes offers outside their active date window', async () => {
    const expiredOffer = {
      ...nearOffer,
      id: 'offer-expired',
      slug: 'expired-offer',
      startDate: new Date('2020-01-01'),
      endDate: new Date('2020-02-01'),
    }
    vi.mocked(prisma.offer.findMany).mockResolvedValue([expiredOffer] as never)

    await getOffersList({ location: null })

    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startDate: expect.objectContaining({ lte: expect.any(Date) }),
          endDate: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    )
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

  it('returns null when the found offer\'s business is not ACTIVE', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: 'offer-3', slug: 'sushi-combo', title: 'Combo Sushi', description: null,
      imageUrl: null, originalPrice: 6990, discountPrice: 4990, discountPercent: 28,
      quantityAvailable: null, startDate: new Date('2026-01-01'), endDate: new Date('2026-02-01'),
      business: { name: 'Pending Sushi', slug: 'pending-sushi', whatsapp: null, city: 'Marmeleiro', state: 'PR', status: 'PENDING', owner: { blocked: false } },
    } as never)

    const result = await getOfferBySlug('sushi-combo')

    expect(result).toBeNull()
  })

  it('returns null when the found offer\'s business owner is blocked, even though the business is ACTIVE', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: 'offer-4', slug: 'blocked-bakery-combo', title: 'Combo Padaria', description: null,
      imageUrl: null, originalPrice: 3990, discountPrice: 2990, discountPercent: 25,
      quantityAvailable: null, startDate: new Date('2026-01-01'), endDate: new Date('2026-02-01'),
      business: { name: 'Blocked Bakery', slug: 'blocked-bakery', whatsapp: null, city: 'Marmeleiro', state: 'PR', status: 'ACTIVE', owner: { blocked: true } },
    } as never)

    const result = await getOfferBySlug('blocked-bakery-combo')

    expect(result).toBeNull()
  })

  it('maps the offer and its business when found', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', description: 'Pão, carne e queijo.',
      imageUrl: null, originalPrice: 4290, discountPrice: 2990, discountPercent: 30,
      quantityAvailable: null, startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
      business: { id: 'biz-1', name: 'Big Burger', slug: 'big-burger', whatsapp: '5546999990000', city: 'Marmeleiro', state: 'PR', status: 'ACTIVE', owner: { blocked: false }, deliveryZones: [] },
    } as never)

    const result = await getOfferBySlug('combo-burguer')

    expect(result).not.toBeNull()
    expect(result?.title).toBe('Combo Burguer')
    expect(result?.business.name).toBe('Big Burger')
    expect(prisma.offer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'combo-burguer' } }),
    )
  })

  it('includes only active delivery zones, mapped to id/neighborhood/feeCents', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', description: 'Pão, carne e queijo.',
      imageUrl: null, originalPrice: 4290, discountPrice: 2990, discountPercent: 30,
      quantityAvailable: null, startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
      business: {
        id: 'biz-1', name: 'Big Burger', slug: 'big-burger', whatsapp: '5546999990000', city: 'Marmeleiro', state: 'PR', status: 'ACTIVE', owner: { blocked: false },
        deliveryZones: [{ id: 'zone-1', neighborhood: 'Centro', feeCents: 500, active: true }],
      },
    } as never)

    const result = await getOfferBySlug('combo-burguer')

    expect(result?.deliveryZones).toEqual([{ id: 'zone-1', neighborhood: 'Centro', feeCents: 500 }])
    expect(result?.business.id).toBe('biz-1')
  })
})
