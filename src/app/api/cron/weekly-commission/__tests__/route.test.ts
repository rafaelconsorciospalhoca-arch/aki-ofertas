import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/cron/weekly-commission/route'
import { generateWeeklyCommissionInvoices } from '@/lib/weekly-commission'

vi.mock('@/lib/weekly-commission', () => ({ generateWeeklyCommissionInvoices: vi.fn() }))

function request(authHeader?: string) {
  return new Request('https://akiofertas.com.br/api/cron/weekly-commission', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/weekly-commission', () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = originalSecret
  })

  it('rejects without the correct bearer token', async () => {
    process.env.CRON_SECRET = 'the-secret'

    const response = await GET(request('Bearer wrong'))
    expect(response.status).toBe(401)
    expect(generateWeeklyCommissionInvoices).not.toHaveBeenCalled()
  })

  it('rejects (fails closed) when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(request('Bearer undefined'))
    expect(response.status).toBe(401)
  })

  it('runs the weekly commission generation and returns its result', async () => {
    process.env.CRON_SECRET = 'the-secret'
    vi.mocked(generateWeeklyCommissionInvoices).mockResolvedValue({ created: 3, skipped: 2, failed: 0 })

    const response = await GET(request('Bearer the-secret'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: 3, skipped: 2, failed: 0 })
  })
})
