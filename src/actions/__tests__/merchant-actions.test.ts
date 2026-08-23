import { afterEach, describe, expect, it, vi } from 'vitest'
import { signUpMerchant } from '@/actions/merchant-actions'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
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
  lat: -25.9,
  lng: -53.05,
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

  it('creates the owner and business, uppercasing the state and hashing the password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-free', name: 'Grátis' } as never)

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
  })
})
