import { afterEach, describe, expect, it, vi } from 'vitest'
import { signUpMerchant, updateBusiness } from '@/actions/merchant-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    city: { findFirst: vi.fn() },
    business: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/geocode', () => ({
  geocodeAddress: vi.fn(),
}))

const validInput = {
  ownerName: 'João Silva',
  email: 'joao@example.com',
  password: 'senha1234',
  businessName: 'Pizza Boa',
  categoryId: 'cat-1',
  whatsapp: '5546999998888',
  address: 'Rua das Flores, 10',
  city: 'Marmeleiro',
  state: 'pr',
}

describe('signUpMerchant', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid email', async () => {
    const result = await signUpMerchant({ ...validInput, email: 'not-an-email' })
    expect(result).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects a state that is not a 2-letter code', async () => {
    const result = await signUpMerchant({ ...validInput, state: 'Parana' })
    expect(result).toEqual({ ok: false, error: 'Use a sigla do estado (ex: PR).' })
  })

  it('rejects a duplicate email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const result = await signUpMerchant(validInput)
    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
  })

  it('fails gracefully when the free plan is missing', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null as never)

    const result = await signUpMerchant(validInput)
    expect(result).toEqual({
      ok: false,
      error: 'Não foi possível concluir o cadastro. Tente novamente mais tarde.',
    })
  })

  it('fails gracefully when the address cannot be geocoded', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-free', name: 'Grátis' } as never)
    vi.mocked(geocodeAddress).mockResolvedValue(null)

    const result = await signUpMerchant(validInput)

    expect(result).toEqual({ ok: false, error: 'Não foi possível localizar esse endereço. Confira e tente novamente.' })
  })

  it('creates the owner and business, uppercasing the state and hashing the password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-free', name: 'Grátis' } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue({ id: 'city-1', name: 'Marmeleiro', state: 'PR' } as never)
    vi.mocked(geocodeAddress).mockResolvedValue({ lat: -25.9, lng: -53.05 })

    const userCreate = vi.fn().mockResolvedValue({ id: 'user-1' })
    const businessCreate = vi.fn().mockResolvedValue({ id: 'biz-1' })

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: unknown) => {
      return (callback as (tx: unknown) => unknown)({
        user: { create: userCreate },
        business: { create: businessCreate },
      })
    })

    const result = await signUpMerchant(validInput)

    expect(result).toEqual({ ok: true, businessId: 'biz-1' })
    expect(userCreate.mock.calls[0][0].data.role).toBe('MERCHANT')
    expect(userCreate.mock.calls[0][0].data.passwordHash).not.toBe('senha1234')

    const businessData = businessCreate.mock.calls[0][0].data
    expect(businessData.ownerId).toBe('user-1')
    expect(businessData.state).toBe('PR')
    expect(businessData.status).toBe('PENDING')
    expect(businessData.planId).toBe('plan-free')
    expect((businessData.slug as string).startsWith('pizza-boa-')).toBe(true)
    expect(businessData.serviceCities).toEqual({ connect: { id: 'city-1' } })
    expect(businessData.lat).toBe(-25.9)
    expect(businessData.lng).toBe(-53.05)
    expect(geocodeAddress).toHaveBeenCalledWith('Rua das Flores, 10, Marmeleiro - PR, Brasil')
  })
})

const validBusinessInput = {
  name: 'Pizza Boa',
  categoryId: 'cat-1',
  address: 'Rua das Flores, 10',
  city: 'Marmeleiro',
  state: 'pr',
}

describe('updateBusiness', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateBusiness(validBusinessInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the session role is not MERCHANT', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'CONSUMER' } } as never)
    const result = await updateBusiness(validBusinessInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects invalid input', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await updateBusiness({ ...validBusinessInput, state: 'Parana' })
    expect(result).toEqual({ ok: false, error: 'Use a sigla do estado (ex: PR).' })
  })

  it('rejects when no business is owned by this user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(null as never)

    const result = await updateBusiness(validBusinessInput)
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('rejects when the owner account is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1',
      owner: { id: 'u1', blocked: true },
    } as never)

    const result = await updateBusiness(validBusinessInput)
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('updates the business owned by this user, uppercasing the state', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1',
      owner: { id: 'u1', blocked: false },
    } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue({ id: 'city-1', name: 'Marmeleiro', state: 'PR' } as never)

    const result = await updateBusiness(validBusinessInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({ name: 'Pizza Boa', state: 'PR', serviceCities: { set: [{ id: 'city-1' }] } }),
      }),
    )
  })

  it('keeps the merchant-selected extra cities and still includes the primary city', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1',
      owner: { id: 'u1', blocked: false },
    } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue({ id: 'city-1', name: 'Marmeleiro', state: 'PR' } as never)

    const result = await updateBusiness({ ...validBusinessInput, serviceCityIds: ['city-2', 'city-1'] })

    expect(result).toEqual({ ok: true })
    const data = vi.mocked(prisma.business.update).mock.calls[0][0].data as { serviceCities: { set: { id: string }[] } }
    expect(data.serviceCities.set.map((c) => c.id).sort()).toEqual(['city-1', 'city-2'])
  })
})
