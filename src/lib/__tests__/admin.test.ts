import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPlatformStats,
  getBusinessesForAdmin,
  getAllCategories,
  getCategoryById,
  getAllCities,
  getCityById,
  getUsersForAdmin,
  getUserById,
} from '@/lib/admin'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    business: { count: vi.fn(), findMany: vi.fn() },
    offer: { count: vi.fn() },
    city: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

describe('getPlatformStats', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('counts users, businesses (total/pending/active), offers, and cities', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(42)
    vi.mocked(prisma.business.count)
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3) // pending
      .mockResolvedValueOnce(6) // active
    vi.mocked(prisma.offer.count).mockResolvedValue(25)
    vi.mocked(prisma.city.count).mockResolvedValue(4)

    const result = await getPlatformStats()

    expect(result).toEqual({
      totalUsers: 42,
      totalBusinesses: 10,
      pendingBusinesses: 3,
      activeBusinesses: 6,
      totalOffers: 25,
      totalCities: 4,
    })
    expect(prisma.business.count).toHaveBeenNthCalledWith(2, { where: { status: 'PENDING' } })
    expect(prisma.business.count).toHaveBeenNthCalledWith(3, { where: { status: 'ACTIVE' } })
  })
})

describe('getBusinessesForAdmin', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries all businesses with category included when no status is given', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([{ id: 'biz-1' }] as never)

    const result = await getBusinessesForAdmin()

    expect(prisma.business.findMany).toHaveBeenCalledWith({
      where: {},
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'biz-1' }])
  })

  it('filters by status when given', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([] as never)

    await getBusinessesForAdmin('PENDING')

    expect(prisma.business.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('getAllCategories', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries every category ordered by order, including inactive ones', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([{ id: 'cat-1' }] as never)

    const result = await getAllCategories()

    expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { order: 'asc' } })
    expect(result).toEqual([{ id: 'cat-1' }])
  })
})

describe('getCategoryById', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries a single category by id', async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await getCategoryById('cat-1')

    expect(prisma.category.findUnique).toHaveBeenCalledWith({ where: { id: 'cat-1' } })
    expect(result).toEqual({ id: 'cat-1' })
  })
})

describe('getAllCities', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries every city ordered by name, including inactive ones', async () => {
    vi.mocked(prisma.city.findMany).mockResolvedValue([{ id: 'city-1' }] as never)

    const result = await getAllCities()

    expect(prisma.city.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } })
    expect(result).toEqual([{ id: 'city-1' }])
  })
})

describe('getCityById', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries a single city by id', async () => {
    vi.mocked(prisma.city.findUnique).mockResolvedValue({ id: 'city-1' } as never)

    const result = await getCityById('city-1')

    expect(prisma.city.findUnique).toHaveBeenCalledWith({ where: { id: 'city-1' } })
    expect(result).toEqual({ id: 'city-1' })
  })
})

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  city: true,
  state: true,
  blocked: true,
  createdAt: true,
}

describe('getUsersForAdmin', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries every user, newest first, when no query is given', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }] as never)

    const result = await getUsersForAdmin()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {},
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'user-1' }])
  })

  it('searches by name or email, case-insensitively, when a query is given', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)

    await getUsersForAdmin('joao')

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: 'joao', mode: 'insensitive' } },
          { email: { contains: 'joao', mode: 'insensitive' } },
        ],
      },
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('getUserById', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries a single user by id, excluding passwordHash', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as never)

    const result = await getUserById('user-1')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: userSelect })
    expect(result).toEqual({ id: 'user-1' })
  })
})
