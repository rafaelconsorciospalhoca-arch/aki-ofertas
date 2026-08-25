import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateCoupon } from '@/actions/coupon-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
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
