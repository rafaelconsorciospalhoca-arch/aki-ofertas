import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/mobile/favoritos/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { getFavoritesForUser, toggleFavorite } from '@/lib/favorites'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/favorites', () => ({ getFavoritesForUser: vi.fn(), toggleFavorite: vi.fn() }))

function postRequest(body: unknown) {
  return new Request('https://example.com/api/mobile/favoritos', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('GET /api/mobile/favoritos', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await GET(new Request('https://example.com/api/mobile/favoritos'))
    expect(response.status).toBe(401)
  })

  it('returns the favorites for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(getFavoritesForUser).mockResolvedValue({ offers: [{ id: 'o1' }], businesses: [] } as never)

    const response = await GET(new Request('https://example.com/api/mobile/favoritos'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { offers: [{ id: 'o1' }], businesses: [] } })
    expect(getFavoritesForUser).toHaveBeenCalledWith('user-1')
  })
})

describe('POST /api/mobile/favoritos', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await POST(postRequest({ offerId: 'offer-1' }))
    expect(response.status).toBe(401)
  })

  it('rejects a body with neither offerId nor businessId', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    const response = await POST(postRequest({}))
    expect(response.status).toBe(400)
    expect(toggleFavorite).not.toHaveBeenCalled()
  })

  it('rejects a body with both offerId and businessId', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    const response = await POST(postRequest({ offerId: 'offer-1', businessId: 'biz-1' }))
    expect(response.status).toBe(400)
    expect(toggleFavorite).not.toHaveBeenCalled()
  })

  it('toggles the offer favorite for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(toggleFavorite).mockResolvedValue({ favorited: true })

    const response = await POST(postRequest({ offerId: 'offer-1' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { favorited: true } })
    expect(toggleFavorite).toHaveBeenCalledWith('user-1', { offerId: 'offer-1' })
  })

  it('toggles the business favorite for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(toggleFavorite).mockResolvedValue({ favorited: false })

    const response = await POST(postRequest({ businessId: 'biz-1' }))

    expect(response.status).toBe(200)
    expect(toggleFavorite).toHaveBeenCalledWith('user-1', { businessId: 'biz-1' })
  })
})
