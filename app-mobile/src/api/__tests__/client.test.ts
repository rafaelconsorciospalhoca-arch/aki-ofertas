import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { apiFetch, ApiError } from '@/api/client'

const originalFetch = global.fetch

describe('apiFetch', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns the data field on a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, data: [{ id: 'o1' }] }),
    }) as never

    const result = await apiFetch('/ofertas/destaque')
    expect(result).toEqual([{ id: 'o1' }])
  })

  it('returns the whole payload when there is no data field (auth responses)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, token: 'abc', user: { id: 'u1' } }),
    }) as never

    const result = await apiFetch('/auth/google')
    expect(result).toEqual({ ok: true, token: 'abc', user: { id: 'u1' } })
  })

  it('throws an ApiError with the server message on ok:false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: async () => ({ ok: false, error: 'Oferta não encontrada.' }),
    }) as never

    await expect(apiFetch('/ofertas/nope')).rejects.toThrow('Oferta não encontrada.')
  })

  it('throws an ApiError carrying the HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ ok: false, error: 'Sessão expirada.' }),
    }) as never

    try {
      await apiFetch('/cupons')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(401)
    }
  })

  it('sends the Authorization header when a token is given', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, data: [] }),
    })
    global.fetch = fetchMock as never

    await apiFetch('/cupons', { token: 'my-token' })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer my-token')
  })

  it('does not send an Authorization header when there is no token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, data: [] }),
    })
    global.fetch = fetchMock as never

    await apiFetch('/categorias')

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('sends a JSON body for POST requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, coupon: { code: 'AK1234' } }),
    })
    global.fetch = fetchMock as never

    await apiFetch('/cupons/gerar', { method: 'POST', body: { offerId: 'offer-1' } })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ offerId: 'offer-1' }))
  })
})
