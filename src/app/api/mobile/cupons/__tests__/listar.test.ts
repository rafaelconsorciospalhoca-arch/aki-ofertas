import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from '@/app/api/mobile/cupons/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { getCouponsForUser } from '@/lib/coupons'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/coupons', () => ({ getCouponsForUser: vi.fn() }))

describe('GET /api/mobile/cupons', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await GET(new Request('https://example.com/api/mobile/cupons'))
    expect(response.status).toBe(401)
  })

  it('returns the coupons for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(getCouponsForUser).mockResolvedValue([{ id: 'c1' }] as never)

    const response = await GET(new Request('https://example.com/api/mobile/cupons'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'c1' }] })
    expect(getCouponsForUser).toHaveBeenCalledWith('user-1')
  })
})
