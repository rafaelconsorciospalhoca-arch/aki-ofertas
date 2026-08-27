import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActiveCategories, getActiveCities, getCitiesWithActiveBusinesses } from '@/lib/categories'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    category: { findMany: vi.fn() },
    city: { findMany: vi.fn() },
    business: { findMany: vi.fn() },
  },
}))

describe('getActiveCategories', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries only active categories ordered by their order field', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'cat-1', name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1 },
    ] as never)

    const result = await getActiveCategories()

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, icon: true, order: true },
    })
    expect(result).toEqual([
      { id: 'cat-1', name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1 },
    ])
  })
})

describe('getActiveCities', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries only active cities ordered by name', async () => {
    vi.mocked(prisma.city.findMany).mockResolvedValue([
      { id: 'city-1', name: 'Marmeleiro', state: 'PR' },
    ] as never)

    const result = await getActiveCities()

    expect(prisma.city.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, state: true },
    })
    expect(result).toEqual([
      { id: 'city-1', name: 'Marmeleiro', state: 'PR' },
    ])
  })
})

describe('getCitiesWithActiveBusinesses', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries distinct city/state pairs from active businesses, sorted by name', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { city: 'Marmeleiro', state: 'PR' },
      { city: 'Ampére', state: 'PR' },
    ] as never)

    const result = await getCitiesWithActiveBusinesses()

    expect(prisma.business.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      select: { city: true, state: true },
      distinct: ['city', 'state'],
    })
    expect(result).toEqual([
      { name: 'Ampére', state: 'PR' },
      { name: 'Marmeleiro', state: 'PR' },
    ])
  })

  it('returns an empty array when no business is active', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([] as never)

    const result = await getCitiesWithActiveBusinesses()

    expect(result).toEqual([])
  })
})
