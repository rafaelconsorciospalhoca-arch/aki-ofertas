import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/mobile/lojas/[slug]/cardapio/route'
import { getMenuItemsForBusinessSlug } from '@/lib/menu'

vi.mock('@/lib/menu', () => ({ getMenuItemsForBusinessSlug: vi.fn() }))

describe('GET /api/mobile/lojas/[slug]/cardapio', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns 404 when the business does not exist', async () => {
    vi.mocked(getMenuItemsForBusinessSlug).mockResolvedValue(null)

    const response = await GET(new Request('https://example.com'), { params: { slug: 'nope' } })
    expect(response.status).toBe(404)
  })

  it('returns the menu items', async () => {
    vi.mocked(getMenuItemsForBusinessSlug).mockResolvedValue([
      { id: 'm1', name: 'X-Burger', description: null, price: 2990, imageUrl: null },
    ])

    const response = await GET(new Request('https://example.com'), { params: { slug: 'big-burger' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      data: [{ id: 'm1', name: 'X-Burger', description: null, price: 2990, imageUrl: null }],
    })
  })
})
