import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { lookupCep } from '@/utils/cep'

const originalFetch = global.fetch

describe('lookupCep', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns null without calling fetch when the CEP has fewer than 8 digits', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock

    const result = await lookupCep('1234')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the mapped fields for a valid CEP', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: 'Av. Brasil',
        bairro: 'Centro',
        localidade: 'Marmeleiro',
        uf: 'PR',
      }),
    } as Response)

    const result = await lookupCep('85350-000')

    expect(result).toEqual({ street: 'Av. Brasil', neighborhood: 'Centro', city: 'Marmeleiro', state: 'PR' })
    expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/85350000/json/')
  })

  it('returns null when ViaCEP reports the CEP does not exist', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ erro: true }) } as Response)

    const result = await lookupCep('00000000')
    expect(result).toBeNull()
  })

  it('returns null when the request fails', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockRejectedValue(new Error('network error'))

    const result = await lookupCep('85350000')
    expect(result).toBeNull()
  })

  it('returns null when the response is not ok', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) } as Response)

    const result = await lookupCep('85350000')
    expect(result).toBeNull()
  })
})
