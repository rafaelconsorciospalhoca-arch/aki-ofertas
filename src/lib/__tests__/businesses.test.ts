import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBusinessBySlug } from '@/lib/businesses'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
  },
}))

describe('getBusinessBySlug', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no business matches', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null as never)

    const result = await getBusinessBySlug('does-not-exist')

    expect(result).toBeNull()
  })

  it('returns null when the business status is not ACTIVE', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', slug: 'pending-business', name: 'Pending Business', description: null,
      logoUrl: null, coverUrl: null, city: 'Marmeleiro', state: 'PR', phone: null,
      whatsapp: null, lat: -25.9006, lng: -53.0489, status: 'PENDING',
      category: { name: 'Restaurantes e Lanchonetes' },
      offers: [],
    } as never)

    const result = await getBusinessBySlug('pending-business')

    expect(result).toBeNull()
  })

  it('maps the business and its active offers when found', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', slug: 'big-burger', name: 'Big Burger', description: 'Hambúrgueres artesanais.',
      logoUrl: null, coverUrl: null, city: 'Marmeleiro', state: 'PR', phone: null,
      whatsapp: '5546999990000', lat: -25.9006, lng: -53.0489, status: 'ACTIVE',
      category: { name: 'Restaurantes e Lanchonetes' },
      offers: [
        {
          id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', imageUrl: null,
          originalPrice: 4290, discountPrice: 2990, discountPercent: 30, createdAt: new Date('2026-01-01'),
        },
      ],
    } as never)

    const result = await getBusinessBySlug('big-burger')

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Big Burger')
    expect(result?.categoryName).toBe('Restaurantes e Lanchonetes')
    expect(result?.offers).toHaveLength(1)
    expect(result?.offers[0].slug).toBe('combo-burguer')
    expect(prisma.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'big-burger' } }),
    )
  })
})
