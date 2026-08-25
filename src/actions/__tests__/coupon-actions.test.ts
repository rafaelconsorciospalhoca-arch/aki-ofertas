import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateCoupon } from '@/actions/coupon-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    coupon: { findUnique: vi.fn(), update: vi.fn() },
    business: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/coupon-code', () => ({
  generateCouponCode: vi.fn(() => 'AK7X9K2'),
}))

function mockTransaction(tx: {
  coupon: { findFirst: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  offer: { findUnique: ReturnType<typeof vi.fn> }
}) {
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: unknown) => {
    return (callback as (tx: unknown) => unknown)(tx)
  })
}

const activeOffer = {
  id: 'offer-1',
  status: 'ACTIVE',
  endDate: new Date('2026-07-01'),
  quantityAvailable: null,
}

describe('generateCoupon', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the offer does not exist or is not ACTIVE', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn(), create: vi.fn() },
      offer: { findUnique: vi.fn().mockResolvedValue(null) },
    })

    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('returns the existing coupon instead of creating a second one', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    const existing = { id: 'coupon-1', code: 'AK1234', expiresAt: new Date('2026-07-01') }
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(existing), count: vi.fn(), create: vi.fn() },
      offer: { findUnique: vi.fn() },
    })

    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: true, coupon: existing })
  })

  it('rejects when the offer has a quantity limit and it has been reached', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(5), create: vi.fn() },
      offer: { findUnique: vi.fn().mockResolvedValue({ ...activeOffer, quantityAvailable: 5 }) },
    })

    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Esta oferta esgotou.' })
  })

  it('creates the coupon when there is no existing one and stock allows it', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    const created = { id: 'coupon-2', code: 'AK7X9K2', expiresAt: activeOffer.endDate }
    const create = vi.fn().mockResolvedValue(created)
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), create },
      offer: { findUnique: vi.fn().mockResolvedValue(activeOffer) },
    })

    const result = await generateCoupon('offer-1')

    expect(result).toEqual({ ok: true, coupon: created })
    const data = create.mock.calls[0][0].data
    expect(data.userId).toBe('user-1')
    expect(data.offerId).toBe('offer-1')
    expect(data.code).toBe('AK7X9K2')
    expect(data.status).toBe('GENERATED')
    expect(data.expiresAt).toEqual(activeOffer.endDate)
  })

  it('does not check stock when quantityAvailable is null', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    const count = vi.fn()
    const create = vi.fn().mockResolvedValue({ id: 'coupon-2', code: 'AK7X9K2', expiresAt: activeOffer.endDate })
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count, create },
      offer: { findUnique: vi.fn().mockResolvedValue(activeOffer) },
    })

    await generateCoupon('offer-1')
    expect(count).not.toHaveBeenCalled()
  })
})

import { validateCoupon } from '@/actions/coupon-actions'

const now = new Date('2026-06-15T12:00:00Z')

const merchantBusiness = { id: 'biz-1', owner: { id: 'merchant-1', blocked: false } }

describe('validateCoupon', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('rejects when there is no merchant session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await validateCoupon('AK7X9K2')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the code does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'merchant-1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(merchantBusiness as never)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue(null)

    const result = await validateCoupon('AK0000')
    expect(result).toEqual({ ok: false, error: 'Cupom não encontrado.' })
  })

  it('rejects when the coupon belongs to a different business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'merchant-1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(merchantBusiness as never)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: 'coupon-1', businessId: 'biz-2', status: 'GENERATED', expiresAt: new Date('2026-07-01'),
      offer: { title: 'Combo' }, user: { name: 'Maria Silva' },
    } as never)

    const result = await validateCoupon('AK7X9K2')
    expect(result).toEqual({ ok: false, error: 'Este cupom não é de uma oferta da sua loja.' })
  })

  it('rejects an already-used coupon', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'merchant-1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(merchantBusiness as never)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: 'coupon-1', businessId: 'biz-1', status: 'USED', expiresAt: new Date('2026-07-01'),
      offer: { title: 'Combo' }, user: { name: 'Maria Silva' },
    } as never)

    const result = await validateCoupon('AK7X9K2')
    expect(result).toEqual({ ok: false, error: 'Este cupom já foi utilizado.' })
  })

  it('rejects an expired coupon', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'merchant-1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(merchantBusiness as never)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: 'coupon-1', businessId: 'biz-1', status: 'GENERATED', expiresAt: new Date('2026-06-01'),
      offer: { title: 'Combo' }, user: { name: 'Maria Silva' },
    } as never)

    const result = await validateCoupon('AK7X9K2')
    expect(result).toEqual({ ok: false, error: 'Este cupom está expirado.' })
  })

  it('marks a valid coupon as used and returns the offer and customer name', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.mocked(auth).mockResolvedValue({ user: { id: 'merchant-1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(merchantBusiness as never)
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: 'coupon-1', businessId: 'biz-1', status: 'GENERATED', expiresAt: new Date('2026-07-01'),
      offer: { title: 'Combo Burguer' }, user: { name: 'Maria Silva' },
    } as never)
    vi.mocked(prisma.coupon.update).mockResolvedValue({} as never)

    const result = await validateCoupon('AK7X9K2')

    expect(result).toEqual({ ok: true, offerTitle: 'Combo Burguer', customerName: 'Maria' })
    expect(prisma.coupon.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'coupon-1' }, data: expect.objectContaining({ status: 'USED' }) }),
    )
  })
})
