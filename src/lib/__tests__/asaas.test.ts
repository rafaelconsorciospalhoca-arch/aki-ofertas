import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas'
import { getAppSettings } from '@/lib/app-settings'

vi.mock('@/lib/app-settings', () => ({ getAppSettings: vi.fn() }))

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

describe('createAsaasCustomer', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('throws when Asaas has not been configured yet', async () => {
    vi.mocked(getAppSettings).mockResolvedValue(null)

    await expect(
      createAsaasCustomer({ name: 'João', cpfCnpj: '123', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' }),
    ).rejects.toThrow('Asaas não configurado.')
  })

  it('throws when the API key for the active mode is missing', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: null } as never)

    await expect(
      createAsaasCustomer({ name: 'João', cpfCnpj: '123', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' }),
    ).rejects.toThrow('Chave de API do Asaas não configurada para o modo atual.')
  })

  it('calls the sandbox base URL with the sandbox key when mode is SANDBOX', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_123' }))
    vi.stubGlobal('fetch', fetchMock)

    const id = await createAsaasCustomer({
      name: 'João', cpfCnpj: '12345678900', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1',
    })

    expect(id).toBe('cus_123')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ access_token: 'sandbox-key' }),
      }),
    )
  })

  it('calls the production base URL with the production key when mode is PRODUCTION', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'PRODUCTION', asaasProductionApiKey: 'prod-key' } as never)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_456' }))
    vi.stubGlobal('fetch', fetchMock)

    await createAsaasCustomer({ name: 'João', cpfCnpj: '123', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.asaas.com/v3/customers',
      expect.objectContaining({ headers: expect.objectContaining({ access_token: 'prod-key' }) }),
    )
  })

  it('throws with the response body when the Asaas API returns an error', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: [{ description: 'CPF inválido' }] }, false)))

    await expect(
      createAsaasCustomer({ name: 'João', cpfCnpj: 'x', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' }),
    ).rejects.toThrow(/CPF inválido/)
  })
})

describe('createAsaasSubscription', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates the subscription and returns the first payment invoice url', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'sub_123' }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ invoiceUrl: 'https://sandbox.asaas.com/i/abc' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createAsaasSubscription({
      customerId: 'cus_123', value: 49.9, description: 'Plano Básico', externalReference: 'biz-1',
    })

    expect(result).toEqual({ subscriptionId: 'sub_123', invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api-sandbox.asaas.com/v3/subscriptions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-sandbox.asaas.com/v3/subscriptions/sub_123/payments',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('throws when the subscription has no payment with an invoice url yet', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: 'sub_123' }))
        .mockResolvedValueOnce(jsonResponse({ data: [] })),
    )

    await expect(
      createAsaasSubscription({ customerId: 'cus_123', value: 49.9, description: 'Plano Básico', externalReference: 'biz-1' }),
    ).rejects.toThrow('Assinatura criada, mas sem link de pagamento.')
  })
})
