import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/cron/expire-trials/route'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}))

function request(authHeader?: string) {
  return new Request('https://akiofertas.com.br/api/cron/expire-trials', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/expire-trials', () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = originalSecret
  })

  it('rejects without the correct bearer token', async () => {
    process.env.CRON_SECRET = 'the-secret'

    const response = await GET(request('Bearer wrong'))
    expect(response.status).toBe(401)
  })

  it('rejects (fails closed) when CRON_SECRET is unset, even with the literal "Bearer undefined" header', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(request('Bearer undefined'))
    expect(response.status).toBe(401)
  })

  it('suspends only ACTIVE businesses past their trial with no active subscription', async () => {
    process.env.CRON_SECRET = 'the-secret'
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { id: 'biz-1', subscriptions: [] },
      { id: 'biz-2', subscriptions: [{ id: 'sub-1' }] },
    ] as never)
    vi.mocked(prisma.business.updateMany).mockResolvedValue({ count: 1 } as never)

    const response = await GET(request('Bearer the-secret'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ suspended: 1 })
    expect(prisma.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', trialEndsAt: { lt: expect.any(Date) } } }),
    )
    expect(prisma.business.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['biz-1'] } },
      data: { status: 'SUSPENDED', suspendedReason: 'TRIAL_EXPIRED' },
    })
  })
})
