import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFavoritesForUser, toggleFavorite } from '@/lib/favorites'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    favorite: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    review: { groupBy: vi.fn().mockResolvedValue([]) },
  },
}))

const business = {
  id: 'biz-1', name: 'Big Burger', slug: 'big-burger', city: 'Marmeleiro', state: 'PR',
  lat: -25.9, lng: -53.05, status: 'ACTIVE', logoUrl: null, category: { name: 'Restaurantes' },
}

const offer = {
  id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', imageUrl: null,
  originalPrice: 4290, discountPrice: 2990, discountPercent: 30, createdAt: new Date('2026-01-01'),
  status: 'ACTIVE', business,
}

const pendingOffer = { ...offer, id: 'offer-2', status: 'PENDING' }
const pendingBusiness = { ...business, id: 'biz-2', status: 'PENDING' }

describe('getFavoritesForUser', () => {
  afterEach(() => vi.clearAllMocks())

  it('maps favorited offers and businesses, skipping non-ACTIVE ones', async () => {
    vi.mocked(prisma.favorite.findMany).mockResolvedValue([
      { offer, business: null },
      { offer: null, business },
      { offer: pendingOffer, business: null },
      { offer: null, business: pendingBusiness },
    ] as never)

    const result = await getFavoritesForUser('user-1')

    expect(result.offers.map((o) => o.slug)).toEqual(['combo-burguer'])
    expect(result.businesses.map((b) => b.slug)).toEqual(['big-burger'])
  })
})

describe('toggleFavorite', () => {
  afterEach(() => vi.clearAllMocks())

  it('creates a favorite when none exists', async () => {
    vi.mocked(prisma.favorite.findFirst).mockResolvedValue(null)

    const result = await toggleFavorite('user-1', { offerId: 'offer-1' })

    expect(result).toEqual({ favorited: true })
    expect(prisma.favorite.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', offerId: 'offer-1', businessId: null },
    })
  })

  it('deletes the existing favorite when one already exists', async () => {
    vi.mocked(prisma.favorite.findFirst).mockResolvedValue({ id: 'fav-1' } as never)

    const result = await toggleFavorite('user-1', { businessId: 'biz-1' })

    expect(result).toEqual({ favorited: false })
    expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { id: 'fav-1' } })
  })
})
