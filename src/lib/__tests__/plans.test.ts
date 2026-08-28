import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPaidPlans } from '@/lib/plans'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: { plan: { findMany: vi.fn() } },
}))

describe('getPaidPlans', () => {
  afterEach(() => vi.clearAllMocks())

  it('queries only plans with a price above zero, ordered by price', async () => {
    vi.mocked(prisma.plan.findMany).mockResolvedValue([
      { id: 'p1', name: 'Básico', priceCents: 4990, maxOffersPerMonth: 5 },
    ] as never)

    const result = await getPaidPlans()

    expect(prisma.plan.findMany).toHaveBeenCalledWith({
      where: { priceCents: { gt: 0 } },
      orderBy: { priceCents: 'asc' },
    })
    expect(result).toEqual([{ id: 'p1', name: 'Básico', priceCents: 4990, maxOffersPerMonth: 5 }])
  })
})
