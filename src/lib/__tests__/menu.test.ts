import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMenuItemsForBusinessSlug } from '@/lib/menu'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    menuItem: { findMany: vi.fn() },
  },
}))

describe('getMenuItemsForBusinessSlug', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns null when the business does not exist', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const result = await getMenuItemsForBusinessSlug('nope')

    expect(result).toBeNull()
  })

  it('returns only active items for the business, ordered', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.menuItem.findMany).mockResolvedValue([
      { id: 'm1', name: 'X-Burger', description: 'Com bacon', price: 2990, imageUrl: null },
    ] as never)

    const result = await getMenuItemsForBusinessSlug('big-burger')

    expect(result).toEqual([{ id: 'm1', name: 'X-Burger', description: 'Com bacon', price: 2990, imageUrl: null }])
    expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1', active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
  })
})
