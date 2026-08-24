import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateBusinessStatus, createCategory, updateCategory, createCity, updateCity } from '@/actions/admin-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    city: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

describe('updateBusinessStatus', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid status value', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    // @ts-expect-error deliberately invalid for the test
    const result = await updateBusinessStatus('biz-1', 'NOT_A_STATUS')
    expect(result).toEqual({ ok: false, error: 'Status inválido.' })
  })

  it('rejects when the business does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('updates the business status when the admin and business are valid', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'ACTIVE' },
    })
  })
})

const validCategoryInput = { name: 'Pet Shop', icon: 'pet', order: '9', active: true }

describe('createCategory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await createCategory(validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    const result = await createCategory({ ...validCategoryInput, name: 'P' })
    expect(result).toEqual({ ok: false, error: 'Informe o nome da categoria.' })
  })

  it('rejects an invalid order', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)

    const result = await createCategory({ ...validCategoryInput, order: 'abc' })
    expect(result).toEqual({ ok: false, error: 'Ordem inválida.' })
  })

  it('rejects a duplicate category name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const result = await createCategory(validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Esta categoria já existe.' })
  })

  it('creates the category when input is valid and the name is free', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.category.create).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await createCategory(validCategoryInput)

    expect(result).toEqual({ ok: true, categoryId: 'cat-1' })
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Pet Shop', icon: 'pet', order: 9, active: true },
    })
  })
})

describe('updateCategory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await updateCategory('cat-1', validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the category does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)

    const result = await updateCategory('cat-1', validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Categoria não encontrada.' })
  })

  it('updates the category when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'cat-1' } as never)
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await updateCategory('cat-1', validCategoryInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { name: 'Pet Shop', icon: 'pet', order: 9, active: true },
    })
  })
})

const validCityInput = { name: 'Curitiba', state: 'pr', active: true, comingSoon: false }

describe('createCity', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await createCity(validCityInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects a state that is not a 2-letter code', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    const result = await createCity({ ...validCityInput, state: 'Parana' })
    expect(result).toEqual({ ok: false, error: 'Use a sigla do estado (ex: PR).' })
  })

  it('rejects a duplicate name+state combination', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue({ id: 'existing' } as never)

    const result = await createCity(validCityInput)
    expect(result).toEqual({ ok: false, error: 'Esta cidade já existe.' })
  })

  it('creates the city, uppercasing the state', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.city.create).mockResolvedValue({ id: 'city-1' } as never)

    const result = await createCity(validCityInput)

    expect(result).toEqual({ ok: true, cityId: 'city-1' })
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: { name: 'Curitiba', state: 'PR', active: true, comingSoon: false },
    })
  })
})

describe('updateCity', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the city does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findUnique).mockResolvedValue(null as never)

    const result = await updateCity('city-1', validCityInput)
    expect(result).toEqual({ ok: false, error: 'Cidade não encontrada.' })
  })

  it('updates the city when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findUnique).mockResolvedValue({ id: 'city-1' } as never)
    vi.mocked(prisma.city.update).mockResolvedValue({ id: 'city-1' } as never)

    const result = await updateCity('city-1', validCityInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.city.update).toHaveBeenCalledWith({
      where: { id: 'city-1' },
      data: { name: 'Curitiba', state: 'PR', active: true, comingSoon: false },
    })
  })
})
