import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActiveCategories, getActiveCities } from '@/lib/categories'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    category: { findMany: vi.fn() },
    city: { findMany: vi.fn() },
  },
}))

describe('getActiveCategories', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries only active categories ordered by their order field', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'cat-1', name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1, active: true },
    ] as never)

    const result = await getActiveCategories()

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
    expect(result).toEqual([
      { id: 'cat-1', name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1, active: true },
    ])
  })
})

describe('getActiveCities', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries only active cities ordered by name', async () => {
    vi.mocked(prisma.city.findMany).mockResolvedValue([
      { id: 'city-1', name: 'Marmeleiro', state: 'PR', active: true, comingSoon: false },
    ] as never)

    const result = await getActiveCities()

    expect(prisma.city.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
    expect(result).toEqual([
      { id: 'city-1', name: 'Marmeleiro', state: 'PR', active: true, comingSoon: false },
    ])
  })
})
