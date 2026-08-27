import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCoupon, validateCoupon } from '@/actions/coupon-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    coupon: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    business: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
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

const DAY = 24 * 60 * 60 * 1000

function p2002(target: string[]) {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target } })
}

function p2034() {
  return Object.assign(new Error('Write conflict'), { code: 'P2034' })
}

const activeOffer = {
  id: 'offer-1',
  status: 'ACTIVE',
  businessId: 'biz-1',
  startDate: new Date(Date.now() - DAY),
  endDate: new Date(Date.now() + 30 * DAY),
  quantityAvailable: null,
  customCouponCode: null,
  business: { status: 'ACTIVE', owner: { blocked: false } },
}

describe('generateCoupon', () => {
  beforeEach(() => {
    // Most tests exercise behavior downstream of the phone-on-file gate;
    // give them a user who already has one and let the two phone-specific
    // tests below override this.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ phone: '5546999990000' } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the user has no phone on file', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ phone: null } as never)

    const result = await generateCoupon('offer-1')

    expect(result).toEqual({ ok: false, error: 'Informe seu telefone para resgatar o cupom.' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
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
      offer: { findUnique: vi.fn().mockResolvedValue(activeOffer) },
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

  it('rejects when the business is not ACTIVE', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn(), create: vi.fn() },
      offer: {
        findUnique: vi.fn().mockResolvedValue({
          ...activeOffer,
          business: { status: 'SUSPENDED', owner: { blocked: false } },
        }),
      },
    })

    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('rejects when the business owner is blocked', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn(), create: vi.fn() },
      offer: {
        findUnique: vi.fn().mockResolvedValue({
          ...activeOffer,
          business: { status: 'ACTIVE', owner: { blocked: true } },
        }),
      },
    })

    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('rejects when the offer has not started yet', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn(), create: vi.fn() },
      offer: {
        findUnique: vi.fn().mockResolvedValue({ ...activeOffer, startDate: new Date(Date.now() + DAY) }),
      },
    })

    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('rejects when the offer has already ended', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockTransaction({
      coupon: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn(), create: vi.fn() },
      offer: {
        findUnique: vi.fn().mockResolvedValue({ ...activeOffer, endDate: new Date(Date.now() - DAY) }),
      },
    })

    const result = await generateCoupon('offer-1')
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('runs the transaction with Serializable isolation', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockTransaction({
      coupon: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'c', code: 'AK7X9K2', expiresAt: activeOffer.endDate }),
      },
      offer: { findUnique: vi.fn().mockResolvedValue(activeOffer) },
    })

    await generateCoupon('offer-1')

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
  })

  it('returns the winning coupon when a concurrent request already created one', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    const winner = { id: 'coupon-9', code: 'AKWIN1', expiresAt: activeOffer.endDate, offer: { customCouponCode: null } }
    vi.mocked(prisma.$transaction).mockRejectedValue(p2002(['userId', 'offerId']))
    vi.mocked(prisma.coupon.findFirst).mockResolvedValue(winner as never)

    const result = await generateCoupon('offer-1')

    expect(result).toEqual({ ok: true, coupon: { id: 'coupon-9', code: 'AKWIN1', expiresAt: activeOffer.endDate } })
    expect(prisma.coupon.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', offerId: 'offer-1' } }),
    )
    // The recovery read happens outside the aborted transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('retries the whole transaction on a serialization conflict', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    const created = { id: 'coupon-3', code: 'AK7X9K2', expiresAt: activeOffer.endDate }
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(p2034())
      .mockResolvedValueOnce({ ok: true, coupon: created } as never)

    const result = await generateCoupon('offer-1')

    expect(result).toEqual({ ok: true, coupon: created })
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('gives up with a generic message after exhausting the retries', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.mocked(prisma.$transaction).mockRejectedValue(p2034())

    const result = await generateCoupon('offer-1')

    expect(result).toEqual({ ok: false, error: 'Não foi possível gerar o cupom. Tente novamente.' })
    expect(prisma.$transaction).toHaveBeenCalledTimes(3)
  })

  it('retries with a fresh code when the code collides', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    const created = { id: 'coupon-4', code: 'AK7X9K2', expiresAt: activeOffer.endDate }
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(p2002(['code']))
      .mockResolvedValueOnce({ ok: true, coupon: created } as never)

    const result = await generateCoupon('offer-1')

    expect(result).toEqual({ ok: true, coupon: created })
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('does not let an unexpected error escape the action', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('connection lost'))

    const result = await generateCoupon('offer-1')

    expect(result).toEqual({ ok: false, error: 'Não foi possível gerar o cupom. Tente novamente.' })
  })
})

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
