import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOffer, updateOffer, cancelOffer } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findFirst: vi.fn() },
    offer: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const validInput = {
  title: 'Combo Especial',
  originalPrice: '42.90',
  discountPrice: '29.90',
  categoryId: 'cat-1',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
}

const unblockedBusiness = { id: 'biz-1', owner: { id: 'u1', blocked: false } }
const blockedOwnerBusiness = { id: 'biz-1', owner: { id: 'u1', blocked: true } }
const suspendedBusiness = { id: 'biz-1', status: 'SUSPENDED', owner: { id: 'u1', blocked: false } }
const businessAtLimit = { id: 'biz-1', owner: { id: 'u1', blocked: false }, plan: { maxOffersPerMonth: 5 } }
const businessBelowLimit = { id: 'biz-1', owner: { id: 'u1', blocked: false }, plan: { maxOffersPerMonth: 5 } }

describe('createOffer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no merchant session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await createOffer(validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the session role is not MERCHANT', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'CONSUMER' } } as never)
    const result = await createOffer(validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the merchant owner account is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(blockedOwnerBusiness as never)

    const result = await createOffer(validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the business is SUSPENDED (paywall enforced server-side via requireMerchantBusiness)', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(suspendedBusiness as never)

    const result = await createOffer(validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects invalid pricing', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(unblockedBusiness as never)

    const result = await createOffer({ ...validInput, discountPrice: '50.00' })
    expect(result).toEqual({ ok: false, error: 'O preço promocional precisa ser menor que o preço original.' })
  })

  it('creates the offer under the merchant business with a generated slug', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(unblockedBusiness as never)
    vi.mocked(prisma.offer.create).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await createOffer(validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    const data = vi.mocked(prisma.offer.create).mock.calls[0][0].data
    expect(data.businessId).toBe('biz-1')
    expect(data.status).toBe('ACTIVE')
    expect(data.discountPercent).toBe(30)
    expect((data.slug as string).startsWith('combo-especial-')).toBe(true)
  })

  it('rejects creating an offer when the business already has the max active offers for its plan', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(businessAtLimit as never)
    vi.mocked(prisma.offer.count).mockResolvedValue(5)

    const result = await createOffer(validInput)

    expect(result).toEqual({
      ok: false,
      error: 'Você atingiu o limite de 5 ofertas ativas do seu plano. Desative uma oferta ou assine um plano maior pra criar mais.',
    })
    expect(prisma.offer.create).not.toHaveBeenCalled()
    expect(prisma.offer.count).toHaveBeenCalledWith({ where: { businessId: 'biz-1', status: 'ACTIVE' } })
  })

  it('creates the offer when the business is below its plan limit', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(businessBelowLimit as never)
    vi.mocked(prisma.offer.count).mockResolvedValue(3)
    vi.mocked(prisma.offer.create).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await createOffer(validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    expect(prisma.offer.create).toHaveBeenCalled()
  })

  it('does not check the limit when the business has no plan', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1', owner: { id: 'u1', blocked: false }, plan: null } as never)
    vi.mocked(prisma.offer.create).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await createOffer(validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    expect(prisma.offer.count).not.toHaveBeenCalled()
  })
})

describe('updateOffer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the merchant owner account is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(blockedOwnerBusiness as never)

    const result = await updateOffer('offer-1', validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the offer does not belong to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(unblockedBusiness as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null as never)

    const result = await updateOffer('offer-2', validInput)
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('updates the offer when it belongs to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(unblockedBusiness as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.offer.update).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await updateOffer('offer-1', validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    expect(prisma.offer.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'offer-1' } }))
  })
})

describe('cancelOffer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the offer does not belong to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(unblockedBusiness as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null as never)

    const result = await cancelOffer('offer-2')
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('marks the offer CANCELLED when it belongs to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(unblockedBusiness as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.offer.update).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await cancelOffer('offer-1')

    expect(result).toEqual({ ok: true })
    expect(prisma.offer.update).toHaveBeenCalledWith({ where: { id: 'offer-1' }, data: { status: 'CANCELLED' } })
  })
})
