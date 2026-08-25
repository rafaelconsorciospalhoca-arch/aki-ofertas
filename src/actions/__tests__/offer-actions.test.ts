import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOffer, updateOffer, cancelOffer } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findFirst: vi.fn() },
    offer: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
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
