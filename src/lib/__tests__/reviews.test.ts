import { afterEach, describe, expect, it, vi } from 'vitest'
import { getReviewsForBusinessSlug, upsertReviewForBusinessSlug, getRatingsForBusinesses } from '@/lib/reviews'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    review: { aggregate: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), groupBy: vi.fn() },
    coupon: { findFirst: vi.fn() },
    order: { findFirst: vi.fn() },
  },
}))

describe('getReviewsForBusinessSlug', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns null when the business does not exist', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const result = await getReviewsForBusinessSlug('nope')

    expect(result).toBeNull()
  })

  it('maps the aggregate and reviews, shortening the reviewer name', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.review.aggregate).mockResolvedValue({ _avg: { rating: 4.5 }, _count: 2 } as never)
    vi.mocked(prisma.review.findMany).mockResolvedValue([
      { id: 'r1', rating: 5, comment: 'Ótimo!', createdAt: new Date('2026-01-01'), user: { name: 'Rafael Consorcio' } },
      { id: 'r2', rating: 4, comment: null, createdAt: new Date('2026-01-02'), user: { name: 'Maria' } },
    ] as never)

    const result = await getReviewsForBusinessSlug('big-burger')

    expect(result).toEqual({
      average: 4.5,
      count: 2,
      reviews: [
        { id: 'r1', rating: 5, comment: 'Ótimo!', createdAt: new Date('2026-01-01'), reviewerName: 'Rafael C.' },
        { id: 'r2', rating: 4, comment: null, createdAt: new Date('2026-01-02'), reviewerName: 'Maria' },
      ],
    })
    expect(prisma.review.aggregate).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      _avg: { rating: true },
      _count: true,
    })
  })
})

describe('getRatingsForBusinesses', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns an empty map without querying when given no ids', async () => {
    const result = await getRatingsForBusinesses([])
    expect(result.size).toBe(0)
    expect(prisma.review.groupBy).not.toHaveBeenCalled()
  })

  it('maps average and count per business, omitting businesses with no reviews', async () => {
    vi.mocked(prisma.review.groupBy).mockResolvedValue([
      { businessId: 'biz-1', _avg: { rating: 4.5 }, _count: 2 },
    ] as never)

    const result = await getRatingsForBusinesses(['biz-1', 'biz-2'])

    expect(result.get('biz-1')).toEqual({ average: 4.5, count: 2 })
    expect(result.has('biz-2')).toBe(false)
    expect(prisma.review.groupBy).toHaveBeenCalledWith({
      by: ['businessId'],
      where: { businessId: { in: ['biz-1', 'biz-2'] } },
      _avg: { rating: true },
      _count: true,
    })
  })
})

describe('upsertReviewForBusinessSlug', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects a rating outside 1-5', async () => {
    const result = await upsertReviewForBusinessSlug('user-1', 'big-burger', 6, null)

    expect(result).toEqual({ ok: false, error: 'A nota precisa ser de 1 a 5.' })
    expect(prisma.business.findUnique).not.toHaveBeenCalled()
  })

  it('rejects when the business does not exist or is not ACTIVE', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const result = await upsertReviewForBusinessSlug('user-1', 'nope', 5, null)

    expect(result).toEqual({ ok: false, error: 'Loja não encontrada.' })
    expect(prisma.review.upsert).not.toHaveBeenCalled()
  })

  it('rejects a reviewer who never used a coupon or placed an order at this business', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'ACTIVE' } as never)
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    const result = await upsertReviewForBusinessSlug('user-1', 'big-burger', 5, 'Muito bom')

    expect(result).toEqual({
      ok: false,
      error: 'Você precisa ter usado um cupom ou feito um pedido nesta loja para avaliar.',
    })
    expect(prisma.review.upsert).not.toHaveBeenCalled()
  })

  it('does not count a generated-but-unused coupon as engagement', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'ACTIVE' } as never)
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    await upsertReviewForBusinessSlug('user-1', 'big-burger', 5, null)

    expect(prisma.coupon.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', businessId: 'biz-1', status: 'USED' },
      select: { id: true },
    })
  })

  it('does not count a cancelled order as engagement', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'ACTIVE' } as never)
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    await upsertReviewForBusinessSlug('user-1', 'big-burger', 5, null)

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', businessId: 'biz-1', status: { not: 'CANCELLED' } },
      select: { id: true },
    })
  })

  it('upserts the review for a user who used a coupon at this business', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'ACTIVE' } as never)
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue({ id: 'coupon-1' } as never)
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    const result = await upsertReviewForBusinessSlug('user-1', 'big-burger', 5, 'Muito bom')

    expect(result).toEqual({ ok: true })
    expect(prisma.review.upsert).toHaveBeenCalledWith({
      where: { userId_businessId: { userId: 'user-1', businessId: 'biz-1' } },
      update: { rating: 5, comment: 'Muito bom' },
      create: { userId: 'user-1', businessId: 'biz-1', rating: 5, comment: 'Muito bom' },
    })
  })

  it('upserts the review for a user who placed a non-cancelled order at this business', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'ACTIVE' } as never)
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue({ id: 'order-1' } as never)

    const result = await upsertReviewForBusinessSlug('user-1', 'big-burger', 5, 'Muito bom')

    expect(result).toEqual({ ok: true })
    expect(prisma.review.upsert).toHaveBeenCalled()
  })
})
