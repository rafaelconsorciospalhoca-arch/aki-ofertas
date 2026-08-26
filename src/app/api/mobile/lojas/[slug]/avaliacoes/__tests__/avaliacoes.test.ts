import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/mobile/lojas/[slug]/avaliacoes/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { getReviewsForBusinessSlug, upsertReviewForBusinessSlug } from '@/lib/reviews'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/reviews', () => ({ getReviewsForBusinessSlug: vi.fn(), upsertReviewForBusinessSlug: vi.fn() }))

function postRequest(body: unknown) {
  return new Request('https://example.com/api/mobile/lojas/big-burger/avaliacoes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('GET /api/mobile/lojas/[slug]/avaliacoes', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns 404 when the business does not exist', async () => {
    vi.mocked(getReviewsForBusinessSlug).mockResolvedValue(null)

    const response = await GET(new Request('https://example.com'), { params: { slug: 'nope' } })
    expect(response.status).toBe(404)
  })

  it('returns the reviews summary', async () => {
    vi.mocked(getReviewsForBusinessSlug).mockResolvedValue({ average: 4.5, count: 2, reviews: [] })

    const response = await GET(new Request('https://example.com'), { params: { slug: 'big-burger' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { average: 4.5, count: 2, reviews: [] } })
  })
})

describe('POST /api/mobile/lojas/[slug]/avaliacoes', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await POST(postRequest({ rating: 5 }), { params: { slug: 'big-burger' } })
    expect(response.status).toBe(401)
  })

  it('rejects an invalid rating', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await POST(postRequest({ rating: 6 }), { params: { slug: 'big-burger' } })
    expect(response.status).toBe(400)
    expect(upsertReviewForBusinessSlug).not.toHaveBeenCalled()
  })

  it('submits the review for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(upsertReviewForBusinessSlug).mockResolvedValue({ ok: true })

    const response = await POST(postRequest({ rating: 5, comment: 'Muito bom' }), { params: { slug: 'big-burger' } })

    expect(response.status).toBe(200)
    expect(upsertReviewForBusinessSlug).toHaveBeenCalledWith('user-1', 'big-burger', 5, 'Muito bom')
  })

  it('surfaces a business error from upsertReviewForBusinessSlug with a 400', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(upsertReviewForBusinessSlug).mockResolvedValue({ ok: false, error: 'Loja não encontrada.' })

    const response = await POST(postRequest({ rating: 5 }), { params: { slug: 'nope' } })
    expect(response.status).toBe(400)
  })
})
