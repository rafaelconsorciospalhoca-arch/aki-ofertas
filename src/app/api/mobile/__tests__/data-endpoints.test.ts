import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { parseLocationParams } from '@/lib/mobile-location'
import { GET as getDestaque } from '@/app/api/mobile/ofertas/destaque/route'
import { GET as getOfertas } from '@/app/api/mobile/ofertas/route'
import { GET as getOferta } from '@/app/api/mobile/ofertas/[slug]/route'
import { GET as getLoja } from '@/app/api/mobile/lojas/[slug]/route'
import { GET as getLojasSearch } from '@/app/api/mobile/lojas/route'
import { GET as getCategorias } from '@/app/api/mobile/categorias/route'
import { GET as getCidades } from '@/app/api/mobile/cidades/route'
import { GET as getPerfil, PUT as putPerfil } from '@/app/api/mobile/perfil/route'
import { POST as postTelefone } from '@/app/api/mobile/perfil/telefone/route'
import { getFeaturedOffers, getOffersList, getOfferBySlug } from '@/lib/offers'
import { getBusinessBySlug, searchBusinesses } from '@/lib/businesses'
import { getActiveCategories, getActiveCities } from '@/lib/categories'
import { requireMobileUser } from '@/lib/mobile-session'
import { prisma } from '@/lib/db'

vi.mock('@/lib/offers', () => ({
  getFeaturedOffers: vi.fn(),
  getOffersList: vi.fn(),
  getOfferBySlug: vi.fn(),
}))
vi.mock('@/lib/businesses', () => ({ getBusinessBySlug: vi.fn(), searchBusinesses: vi.fn() }))
vi.mock('@/lib/categories', () => ({ getActiveCategories: vi.fn(), getActiveCities: vi.fn() }))
vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }))

describe('parseLocationParams', () => {
  it('parses lat/lng when both are present', () => {
    const result = parseLocationParams(new URLSearchParams('lat=-25.9&lng=-53.05'))
    expect(result).toEqual({ location: { lat: -25.9, lng: -53.05 }, city: null })
  })

  it('parses cidade when there is no location', () => {
    const result = parseLocationParams(new URLSearchParams('cidade=Marmeleiro|PR'))
    expect(result).toEqual({ location: null, city: { name: 'Marmeleiro', state: 'PR' } })
  })

  it('prefers location over cidade when both are present', () => {
    const result = parseLocationParams(new URLSearchParams('lat=-25.9&lng=-53.05&cidade=Marmeleiro|PR'))
    expect(result.location).not.toBeNull()
    expect(result.city).toBeNull()
  })

  it('returns nulls when neither is present', () => {
    const result = parseLocationParams(new URLSearchParams())
    expect(result).toEqual({ location: null, city: null })
  })
})

describe('GET /api/mobile/ofertas/destaque', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns featured offers', async () => {
    vi.mocked(getFeaturedOffers).mockResolvedValue([{ id: 'o1' }] as never)
    const response = await getDestaque(new Request('https://example.com/api/mobile/ofertas/destaque?lat=-25.9&lng=-53.05'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'o1' }] })
    expect(getFeaturedOffers).toHaveBeenCalledWith({ location: { lat: -25.9, lng: -53.05 }, city: null, limit: 10 })
  })
})

describe('GET /api/mobile/ofertas', () => {
  afterEach(() => vi.clearAllMocks())

  it('passes categoria and raio through to getOffersList', async () => {
    vi.mocked(getOffersList).mockResolvedValue([] as never)
    const response = await getOfertas(new Request('https://example.com/api/mobile/ofertas?categoria=cat-1&raio=5'))
    expect(response.status).toBe(200)
    expect(getOffersList).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1', radiusKm: 5 }),
    )
  })

  it('passes q through to getOffersList as query', async () => {
    vi.mocked(getOffersList).mockResolvedValue([] as never)
    const response = await getOfertas(new Request('https://example.com/api/mobile/ofertas?q=burguer'))
    expect(response.status).toBe(200)
    expect(getOffersList).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'burguer' }),
    )
  })
})

describe('GET /api/mobile/ofertas/[slug]', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns 404 when the offer does not exist', async () => {
    vi.mocked(getOfferBySlug).mockResolvedValue(null)
    const response = await getOferta(new Request('https://example.com/api/mobile/ofertas/nope'), { params: { slug: 'nope' } })
    expect(response.status).toBe(404)
  })

  it('returns the offer when it exists', async () => {
    vi.mocked(getOfferBySlug).mockResolvedValue({ id: 'o1' } as never)
    const response = await getOferta(new Request('https://example.com/api/mobile/ofertas/combo'), { params: { slug: 'combo' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { id: 'o1' } })
  })
})

describe('GET /api/mobile/lojas/[slug]', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns 404 when the business does not exist', async () => {
    vi.mocked(getBusinessBySlug).mockResolvedValue(null)
    const response = await getLoja(new Request('https://example.com/api/mobile/lojas/nope'), { params: { slug: 'nope' } })
    expect(response.status).toBe(404)
  })

  it('returns the business when it exists', async () => {
    vi.mocked(getBusinessBySlug).mockResolvedValue({ id: 'b1' } as never)
    const response = await getLoja(new Request('https://example.com/api/mobile/lojas/big-burger'), { params: { slug: 'big-burger' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { id: 'b1' } })
  })
})

describe('GET /api/mobile/lojas', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns an empty list without calling searchBusinesses when q is missing', async () => {
    const response = await getLojasSearch(new Request('https://example.com/api/mobile/lojas'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [] })
    expect(searchBusinesses).not.toHaveBeenCalled()
  })

  it('passes q through to searchBusinesses', async () => {
    vi.mocked(searchBusinesses).mockResolvedValue([{ id: 'b1' }] as never)
    const response = await getLojasSearch(new Request('https://example.com/api/mobile/lojas?q=burger'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'b1' }] })
    expect(searchBusinesses).toHaveBeenCalledWith('burger')
  })
})

describe('GET /api/mobile/categorias', () => {
  it('returns active categories', async () => {
    vi.mocked(getActiveCategories).mockResolvedValue([{ id: 'c1' }] as never)
    const response = await getCategorias()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'c1' }] })
  })
})

describe('GET /api/mobile/cidades', () => {
  it('returns active cities', async () => {
    vi.mocked(getActiveCities).mockResolvedValue([{ id: 'ci1' }] as never)
    const response = await getCidades()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'ci1' }] })
  })
})

describe('GET /api/mobile/perfil', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await getPerfil(new Request('https://example.com/api/mobile/perfil'))
    expect(response.status).toBe(401)
  })

  it('returns the profile for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', name: 'Maria', email: 'user@example.com', city: 'Marmeleiro', phone: '5546999990000',
    } as never)

    const response = await getPerfil(new Request('https://example.com/api/mobile/perfil'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      data: { id: 'user-1', name: 'Maria', email: 'user@example.com', city: 'Marmeleiro', phone: '5546999990000' },
    })
  })
})

describe('PUT /api/mobile/perfil', () => {
  afterEach(() => vi.clearAllMocks())

  function request(body: unknown) {
    return new Request('https://example.com/api/mobile/perfil', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await putPerfil(request({ name: 'Maria', phone: '5546999990000' }))
    expect(response.status).toBe(401)
  })

  it('rejects an invalid name', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await putPerfil(request({ name: 'M', phone: '5546999990000' }))
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an invalid phone', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await putPerfil(request({ name: 'Maria', phone: '123' }))
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the name and phone for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await putPerfil(request({ name: 'Maria Silva', phone: '5546999990000' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Maria Silva', phone: '5546999990000' },
    })
  })

  it('accepts an empty phone and clears it to null (e.g. Google sign-in users with no phone)', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await putPerfil(request({ name: 'Maria Silva', phone: '' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Maria Silva', phone: null },
    })
  })
})

describe('POST /api/mobile/perfil/telefone', () => {
  afterEach(() => vi.clearAllMocks())

  function request(body: unknown) {
    return new Request('https://example.com/api/mobile/perfil/telefone', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await postTelefone(request({ phone: '5546999990000' }))
    expect(response.status).toBe(401)
  })

  it('rejects an invalid phone', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await postTelefone(request({ phone: '123' }))
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the phone for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)

    const response = await postTelefone(request({ phone: '5546999990000' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { phone: '5546999990000' },
    })
  })
})
