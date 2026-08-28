import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/asaas/route'
import { getAppSettings } from '@/lib/app-settings'
import { activateSubscription, suspendForPayment } from '@/lib/billing'

vi.mock('@/lib/app-settings', () => ({ getAppSettings: vi.fn() }))
vi.mock('@/lib/billing', () => ({ activateSubscription: vi.fn(), suspendForPayment: vi.fn() }))

function request(body: unknown, token?: string) {
  return new Request('https://akiofertas.com.br/api/webhooks/asaas', {
    method: 'POST',
    headers: token ? { 'asaas-access-token': token } : {},
    body: JSON.stringify(body),
  })
}

describe('POST /api/webhooks/asaas', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when no webhook token is configured yet', async () => {
    vi.mocked(getAppSettings).mockResolvedValue(null)

    const response = await POST(request({ event: 'PAYMENT_CONFIRMED' }, 'anything'))
    expect(response.status).toBe(401)
  })

  it('rejects when the token header does not match', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    const response = await POST(request({ event: 'PAYMENT_CONFIRMED' }, 'wrong-token'))
    expect(response.status).toBe(401)
  })

  it('activates the subscription on PAYMENT_CONFIRMED', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    const response = await POST(
      request({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', subscription: 'sub_123' } }, 'correct-token'),
    )

    expect(response.status).toBe(200)
    expect(activateSubscription).toHaveBeenCalledWith('sub_123')
  })

  it('activates the subscription on PAYMENT_RECEIVED', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    await POST(request({ event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub_123' } }, 'correct-token'))

    expect(activateSubscription).toHaveBeenCalledWith('sub_123')
  })

  it('suspends the business on PAYMENT_OVERDUE', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    await POST(request({ event: 'PAYMENT_OVERDUE', payment: { subscription: 'sub_123' } }, 'correct-token'))

    expect(suspendForPayment).toHaveBeenCalledWith('sub_123')
  })

  it('suspends the business on SUBSCRIPTION_DELETED, reading the subscription id from the subscription object', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    await POST(request({ event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_123' } }, 'correct-token'))

    expect(suspendForPayment).toHaveBeenCalledWith('sub_123')
  })

  it('ignores unrecognized events without erroring', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    const response = await POST(request({ event: 'PAYMENT_CREATED' }, 'correct-token'))

    expect(response.status).toBe(200)
    expect(activateSubscription).not.toHaveBeenCalled()
    expect(suspendForPayment).not.toHaveBeenCalled()
  })
})
