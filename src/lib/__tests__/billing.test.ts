import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateSubscription, suspendForPayment } from '@/lib/billing'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

describe('activateSubscription', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when no local subscription matches the Asaas id', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null)

    await activateSubscription('sub_unknown')

    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('activates the local subscription and the business plan', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: 'sub-local-1', businessId: 'biz-1', planId: 'plan-1',
    } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'TRIAL_EXPIRED' } as never)

    await activateSubscription('sub_123')

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-local-1' },
      data: { status: 'ACTIVE' },
    })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { planId: 'plan-1', status: 'ACTIVE', suspendedReason: null },
    })
  })

  it('never lifts an admin-imposed suspension', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: 'sub-local-1', businessId: 'biz-1', planId: 'plan-1',
    } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'ADMIN' } as never)

    await activateSubscription('sub_123')

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { planId: 'plan-1' },
    })
  })
})

describe('suspendForPayment', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when no local subscription matches the Asaas id', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null)

    await suspendForPayment('sub_unknown')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('suspends the business for payment when the subscription is found', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-local-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: null } as never)

    await suspendForPayment('sub_123')

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-local-1' }, data: { status: 'INACTIVE' } })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'SUSPENDED', suspendedReason: 'PAYMENT_OVERDUE' },
    })
  })

  it('never overrides an admin-imposed suspension', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-local-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'ADMIN' } as never)

    await suspendForPayment('sub_123')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})
