import { afterEach, describe, expect, it, vi } from 'vitest'
import { signUpMerchant, updateBusiness, subscribeToPlan } from '@/actions/merchant-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    city: { findFirst: vi.fn() },
    business: { findFirst: vi.fn(), update: vi.fn() },
    subscription: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/geocode', () => ({
  geocodeAddress: vi.fn(),
}))

vi.mock('@/lib/asaas', () => ({
  createAsaasCustomer: vi.fn(),
  createAsaasSubscription: vi.fn(),
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

  it('falls back to city-level coordinates when the exact address cannot be geocoded', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-free', name: 'Grátis' } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue(null)
    vi.mocked(geocodeAddress).mockResolvedValueOnce(null).mockResolvedValueOnce({ lat: -26.14, lng: -53.02 })

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
    expect(geocodeAddress).toHaveBeenCalledTimes(2)
    expect(geocodeAddress).toHaveBeenNthCalledWith(2, 'Marmeleiro - PR, Brasil')
    const businessData = businessCreate.mock.calls[0][0].data
    expect(businessData.lat).toBe(-26.14)
    expect(businessData.lng).toBe(-53.02)
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

describe('subscribeToPlan', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not a merchant session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await subscribeToPlan('plan-1', '12345678900')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when no CPF/CNPJ was provided', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await subscribeToPlan('plan-1', '')
    expect(result).toEqual({ ok: false, error: 'Informe seu CPF ou CNPJ.' })
  })

  it('rejects when the plan does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: false, commissionOverridePercent: null,
      category: { commissionPercent: null },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null)

    const result = await subscribeToPlan('plan-1', '12345678900')
    expect(result).toEqual({ ok: false, error: 'Plano não encontrado.' })
  })

  it('creates an Asaas customer when the business has none yet, then the subscription, and returns the invoice url', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: false, commissionOverridePercent: null,
      category: { commissionPercent: null },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(createAsaasCustomer).mockResolvedValue('cus_123')
    vi.mocked(createAsaasSubscription).mockResolvedValue({ subscriptionId: 'sub_123', invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

    const result = await subscribeToPlan('plan-1', '12345678900')

    expect(result).toEqual({ ok: true, invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz-1' }, data: { document: '12345678900', asaasCustomerId: 'cus_123' } })
    expect(createAsaasCustomer).toHaveBeenCalledWith({
      name: 'João', cpfCnpj: '12345678900', email: 'joao@x.com', mobilePhone: '5546999990000', externalReference: 'biz-1',
    })
    expect(createAsaasSubscription).toHaveBeenCalledWith({
      customerId: 'cus_123', value: 49.9, description: 'Plano Básico', externalReference: 'biz-1',
    })
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: { businessId: 'biz-1', planId: 'plan-1', status: 'PENDING', asaasSubscriptionId: 'sub_123' },
    })
  })

  it('reuses an existing Asaas customer id instead of creating a new one', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: '12345678900', asaasCustomerId: 'cus_existing', whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: false, commissionOverridePercent: null,
      category: { commissionPercent: null },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(createAsaasSubscription).mockResolvedValue({ subscriptionId: 'sub_123', invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

    await subscribeToPlan('plan-1', '12345678900')

    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(createAsaasSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_existing' }),
    )
  })

  it('rejects when the business already has an active or pending subscription, without calling Asaas', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', status: 'ACTIVE', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: false, commissionOverridePercent: null,
      category: { commissionPercent: null },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-existing', status: 'ACTIVE' } as never)

    const result = await subscribeToPlan('plan-1', '12345678900')

    expect(result).toEqual({ ok: false, error: 'Você já tem uma assinatura em andamento ou ativa.' })
    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(createAsaasSubscription).not.toHaveBeenCalled()
  })

  it('rejects when the business is still PENDING approval', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', status: 'PENDING', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: false, commissionOverridePercent: null,
      category: { commissionPercent: null },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)

    const result = await subscribeToPlan('plan-1', '12345678900')

    expect(result).toEqual({ ok: false, error: 'Sua empresa ainda não foi aprovada.' })
    expect(createAsaasCustomer).not.toHaveBeenCalled()
  })

  it('returns a friendly error instead of throwing when Asaas rejects the document', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', status: 'ACTIVE', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: false, commissionOverridePercent: null,
      category: { commissionPercent: null },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null)
    vi.mocked(createAsaasCustomer).mockRejectedValue(new Error('Asaas /customers falhou: CPF inválido'))

    const result = await subscribeToPlan('plan-1', '12345678900')

    expect(result).toEqual({ ok: false, error: 'Não foi possível validar seu CPF/CNPJ. Confira e tente novamente.' })
    expect(createAsaasSubscription).not.toHaveBeenCalled()
  })

  it('skips Asaas billing and activates the subscription directly when the category charges commission', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: false, commissionOverridePercent: null,
      category: { commissionPercent: 10 },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

    const result = await subscribeToPlan('plan-1', '12345678900')

    expect(result).toEqual({ ok: true, invoiceUrl: null })
    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(createAsaasSubscription).not.toHaveBeenCalled()
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: { businessId: 'biz-1', planId: 'plan-1', status: 'ACTIVE' },
    })
  })

  it('skips Asaas billing when a commission override forces commission even without a category default', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      commissionOverrideEnabled: true, commissionOverridePercent: 20,
      category: { commissionPercent: null },
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

    const result = await subscribeToPlan('plan-1', '12345678900')

    expect(result).toEqual({ ok: true, invoiceUrl: null })
    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(createAsaasSubscription).not.toHaveBeenCalled()
  })
})
