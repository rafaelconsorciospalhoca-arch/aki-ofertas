import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateBusinessStatus, updateBusinessCommissionOverride, createCategory, updateCategory, createCity, updateCity, toggleUserBlocked, updateUser, createPlan, updatePlan, saveAppSettings } from '@/actions/admin-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    city: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    plan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    appSettings: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const activeAdmin = { id: 'u1', role: 'ADMIN', blocked: false }
const blockedAdmin = { id: 'u1', role: 'ADMIN', blocked: true }
const activeMerchant = { id: 'u1', role: 'MERCHANT', blocked: false }

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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeMerchant as never)
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the acting admin is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(blockedAdmin as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid status value', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    // @ts-expect-error deliberately invalid for the test
    const result = await updateBusinessStatus('biz-1', 'NOT_A_STATUS')
    expect(result).toEqual({ ok: false, error: 'Status inválido.' })
  })

  it('rejects when the business does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('updates the business status when the admin and business are valid', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'ACTIVE', suspendedReason: null },
    })
  })

  it('sets suspendedReason to ADMIN when an admin suspends a business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'ACTIVE' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessStatus('biz-1', 'SUSPENDED')

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'SUSPENDED', suspendedReason: 'ADMIN' },
    })
  })

  it('sets a 3-day trial when approving a PENDING business to ACTIVE', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'PENDING' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const before = Date.now()
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    const after = Date.now()

    expect(result).toEqual({ ok: true })
    const call = vi.mocked(prisma.business.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 'biz-1' })
    expect(call.data.status).toBe('ACTIVE')
    const trialEndsAt = (call.data as { trialEndsAt: Date }).trialEndsAt.getTime()
    expect(trialEndsAt).toBeGreaterThanOrEqual(before + 3 * 24 * 60 * 60 * 1000 - 1000)
    expect(trialEndsAt).toBeLessThanOrEqual(after + 3 * 24 * 60 * 60 * 1000 + 1000)
  })

  it('does not reset the trial when reactivating a SUSPENDED business to ACTIVE manually', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'SUSPENDED' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    await updateBusinessStatus('biz-1', 'ACTIVE')

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'ACTIVE', suspendedReason: null },
    })
  })

  it('clears suspendedReason when an admin reactivates a SUSPENDED business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1',
      status: 'SUSPENDED',
      suspendedReason: 'ADMIN',
    } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')

    expect(result).toEqual({ ok: true })
    const call = vi.mocked(prisma.business.update).mock.calls[0][0]
    expect((call.data as { suspendedReason: string | null }).suspendedReason).toBeNull()
  })
})

describe('updateBusinessCommissionOverride', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not an admin', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'CATEGORY_DEFAULT' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the business does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'CATEGORY_DEFAULT' })
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('rejects an invalid percent when forcing a commission', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'FORCE_PERCENT', percent: '150' })
    expect(result).toEqual({ ok: false, error: 'Percentual de comissão inválido.' })
  })

  it('rejects a forced percent of 0 (use FORCE_NONE for no commission instead)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'FORCE_PERCENT', percent: '0' })
    expect(result).toEqual({ ok: false, error: 'Percentual de comissão inválido.' })
    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('clears the override when set back to the category default', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'CATEGORY_DEFAULT' })

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { commissionOverrideEnabled: false, commissionOverridePercent: null },
    })
  })

  it('forces no commission', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'FORCE_NONE' })

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { commissionOverrideEnabled: true, commissionOverridePercent: null },
    })
  })

  it('forces a specific commission percent', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'FORCE_PERCENT', percent: '20' })

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { commissionOverrideEnabled: true, commissionOverridePercent: 20 },
    })
  })
})

const validCategoryInput = { name: 'Pet Shop', icon: 'pet', order: '9', active: true, commissionPercent: '' }

describe('createCategory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeMerchant as never)
    const result = await createCategory(validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the acting admin is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(blockedAdmin as never)
    const result = await createCategory(validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    const result = await createCategory({ ...validCategoryInput, name: 'P' })
    expect(result).toEqual({ ok: false, error: 'Informe o nome da categoria.' })
  })

  it('rejects an invalid order', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)

    const result = await createCategory({ ...validCategoryInput, order: 'abc' })
    expect(result).toEqual({ ok: false, error: 'Ordem inválida.' })
  })

  it('rejects a duplicate category name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const result = await createCategory(validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Esta categoria já existe.' })
  })

  it('creates the category when input is valid and the name is free', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.category.create).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await createCategory(validCategoryInput)

    expect(result).toEqual({ ok: true, categoryId: 'cat-1' })
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Pet Shop', icon: 'pet', order: 9, active: true, commissionPercent: null },
    })
  })

  it('rejects an invalid commission percent', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)

    const result = await createCategory({ name: 'Padarias', icon: 'bread', order: '1', active: true, commissionPercent: '150' })
    expect(result).toEqual({ ok: false, error: 'Percentual de comissão inválido.' })
  })

  it('saves a valid commission percent', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.category.create).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await createCategory({ name: 'Padarias', icon: 'bread', order: '1', active: true, commissionPercent: '10' })

    expect(result).toEqual({ ok: true, categoryId: 'cat-1' })
    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ commissionPercent: 10 }) }),
    )
  })
})

describe('updateCategory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeMerchant as never)
    const result = await updateCategory('cat-1', validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the category does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)

    const result = await updateCategory('cat-1', validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Categoria não encontrada.' })
  })

  it('updates the category when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'cat-1' } as never)
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await updateCategory('cat-1', validCategoryInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { name: 'Pet Shop', icon: 'pet', order: 9, active: true, commissionPercent: null },
    })
  })

  it('rejects an invalid commission percent', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await updateCategory('cat-1', { ...validCategoryInput, commissionPercent: '150' })
    expect(result).toEqual({ ok: false, error: 'Percentual de comissão inválido.' })
  })

  it('saves a valid commission percent', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'cat-1' } as never)
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await updateCategory('cat-1', { ...validCategoryInput, commissionPercent: '10' })

    expect(result).toEqual({ ok: true })
    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ commissionPercent: 10 }) }),
    )
  })
})

const validCityInput = { name: 'Curitiba', state: 'pr', active: true, comingSoon: false }

describe('createCity', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeMerchant as never)
    const result = await createCity(validCityInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects a state that is not a 2-letter code', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    const result = await createCity({ ...validCityInput, state: 'Parana' })
    expect(result).toEqual({ ok: false, error: 'Use a sigla do estado (ex: PR).' })
  })

  it('rejects a duplicate name+state combination', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue({ id: 'existing' } as never)

    const result = await createCity(validCityInput)
    expect(result).toEqual({ ok: false, error: 'Esta cidade já existe.' })
  })

  it('creates the city, uppercasing the state', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.city.findUnique).mockResolvedValue(null as never)

    const result = await updateCity('city-1', validCityInput)
    expect(result).toEqual({ ok: false, error: 'Cidade não encontrada.' })
  })

  it('updates the city when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
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

// Helper: `requireAdmin()` and the target-user lookup inside `toggleUserBlocked`/
// `updateUser` both call `prisma.user.findUnique`, keyed by different ids
// (the acting admin's id vs. the target user's id). Route the shared mock by id
// so both calls resolve independently within the same test.
function mockUsersById(users: Record<string, unknown>) {
  vi.mocked(prisma.user.findUnique).mockImplementation(((args: { where: { id: string } }) =>
    Promise.resolve(users[args.where.id] ?? null)) as never)
}

describe('toggleUserBlocked', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'MERCHANT' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'MERCHANT', blocked: false } })
    const result = await toggleUserBlocked('user-2', true)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the acting admin is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: true } })
    const result = await toggleUserBlocked('user-2', true)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the target user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false } })

    const result = await toggleUserBlocked('user-2', true)
    expect(result).toEqual({ ok: false, error: 'Usuário não encontrado.' })
  })

  it('rejects an admin trying to block their own account', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false } })

    const result = await toggleUserBlocked('admin-1', true)
    expect(result).toEqual({ ok: false, error: 'Você não pode bloquear sua própria conta.' })
  })

  it('blocks a different user successfully', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({
      'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false },
      'user-2': { id: 'user-2' },
    })
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-2' } as never)

    const result = await toggleUserBlocked('user-2', true)

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-2' }, data: { blocked: true } })
  })

  it('allows unblocking, including targeting the admin\'s own account', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false } })
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'admin-1' } as never)

    const result = await toggleUserBlocked('admin-1', false)

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'admin-1' }, data: { blocked: false } })
  })
})

const validUserInput = { name: 'Rafael Souza', email: 'rafael@example.com', phone: '5546999997777', city: 'Marmeleiro', state: 'PR' }

describe('updateUser', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'CONSUMER' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'CONSUMER', blocked: false } })
    const result = await updateUser('user-2', validUserInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the acting admin is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: true } })
    const result = await updateUser('user-2', validUserInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false } })
    const result = await updateUser('user-2', { ...validUserInput, name: 'R' })
    expect(result).toEqual({ ok: false, error: 'Informe o nome.' })
  })

  it('rejects when the user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({ 'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false } })

    const result = await updateUser('user-2', validUserInput)
    expect(result).toEqual({ ok: false, error: 'Usuário não encontrado.' })
  })

  it('updates the user when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({
      'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false },
      'user-2': { id: 'user-2' },
    })
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-2' } as never)

    const result = await updateUser('user-2', validUserInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { name: 'Rafael Souza', email: 'rafael@example.com', phone: '5546999997777', city: 'Marmeleiro', state: 'PR' },
    })
  })

  it('rejects an email already used by another user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({
      'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false },
      'user-2': { id: 'user-2' },
    })
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'other-user' } as never)

    const result = await updateUser('user-2', validUserInput)

    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('normalizes the email to lowercase before checking for conflicts and updating', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({
      'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false },
      'user-2': { id: 'user-2' },
    })
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-2' } as never)

    const result = await updateUser('user-2', { ...validUserInput, email: 'Rafael@Example.com' })

    expect(result).toEqual({ ok: true })
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'rafael@example.com', NOT: { id: 'user-2' } },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { name: 'Rafael Souza', email: 'rafael@example.com', phone: '5546999997777', city: 'Marmeleiro', state: 'PR' },
    })
  })
})

const validPlanInput = { name: 'Turbo', priceReais: '199.90', maxOffersPerMonth: '30', hasFlashOffers: true, hasFullMetrics: true }

describe('createPlan', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not an admin', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await createPlan(validPlanInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects a duplicate plan name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'p1' } as never)

    const result = await createPlan(validPlanInput)
    expect(result).toEqual({ ok: false, error: 'Este plano já existe.' })
  })

  it('creates the plan, converting reais to cents', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.create).mockResolvedValue({ id: 'p1' } as never)

    const result = await createPlan(validPlanInput)

    expect(result).toEqual({ ok: true, planId: 'p1' })
    expect(prisma.plan.create).toHaveBeenCalledWith({
      data: { name: 'Turbo', priceCents: 19990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
    })
  })
})

describe('updatePlan', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the plan does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null)

    const result = await updatePlan('p1', validPlanInput)
    expect(result).toEqual({ ok: false, error: 'Plano não encontrado.' })
  })

  it('updates the plan, converting reais to cents', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.plan.update).mockResolvedValue({ id: 'p1' } as never)

    const result = await updatePlan('p1', validPlanInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { name: 'Turbo', priceCents: 19990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
    })
  })
})

describe('saveAppSettings', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not an admin', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await saveAppSettings({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('saves the settings when the caller is an admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.appSettings.create).mockResolvedValue({ id: 's1' } as never)

    const result = await saveAppSettings({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key' })

    expect(result).toEqual({ ok: true })
    expect(prisma.appSettings.create).toHaveBeenCalledWith({
      data: { asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key' },
    })
  })
})
