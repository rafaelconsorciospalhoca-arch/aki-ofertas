import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from '@/app/api/mobile/cupons/gerar/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { generateCouponForUser } from '@/actions/coupon-actions'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/actions/coupon-actions', () => ({ generateCouponForUser: vi.fn() }))

function request(body: unknown, authorized = true) {
  return new Request('https://example.com/api/mobile/cupons/gerar', {
    method: 'POST',
    headers: authorized ? { authorization: 'Bearer token' } : {},
    body: JSON.stringify(body),
  })
}

describe('POST /api/mobile/cupons/gerar', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await POST(request({ offerId: 'offer-1' }, false))
    expect(response.status).toBe(401)
  })

  it('rejects invalid body', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    const response = await POST(request({}))
    expect(response.status).toBe(400)
  })

  it('generates the coupon for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(generateCouponForUser).mockResolvedValue({ ok: true, coupon: { id: 'c1', code: 'AK1234', expiresAt: new Date() } })

    const response = await POST(request({ offerId: 'offer-1' }))

    expect(response.status).toBe(200)
    expect(generateCouponForUser).toHaveBeenCalledWith('user-1', 'offer-1')
  })

  it('surfaces a business error from generateCouponForUser with a 400', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(generateCouponForUser).mockResolvedValue({ ok: false, error: 'Esta oferta esgotou.' })

    const response = await POST(request({ offerId: 'offer-1' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Esta oferta esgotou.' })
  })
})
