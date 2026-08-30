import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateSubscription, suspendForPayment, markCommissionInvoicePaid, markCommissionInvoiceOverdue } from '@/lib/billing'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn(), update: vi.fn() },
    commissionInvoice: { findUnique: vi.fn(), update: vi.fn() },
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
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', status: 'SUSPENDED', suspendedReason: 'TRIAL_EXPIRED',
    } as never)

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

  it('never lifts an admin-imposed suspension (only updates planId)', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: 'sub-local-1', businessId: 'biz-1', planId: 'plan-1',
    } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', status: 'SUSPENDED', suspendedReason: 'ADMIN',
    } as never)

    await activateSubscription('sub_123')

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { planId: 'plan-1' },
    })
  })

  it('does not promote a REJECTED business to ACTIVE', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: 'sub-local-1', businessId: 'biz-1', planId: 'plan-1',
    } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', status: 'REJECTED', suspendedReason: null,
    } as never)

    await activateSubscription('sub_123')

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { planId: 'plan-1' },
    })
  })

  it('only updates planId when the business is already ACTIVE (plan upgrade, no suspension to lift)', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: 'sub-local-1', businessId: 'biz-1', planId: 'plan-2',
    } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', status: 'ACTIVE', suspendedReason: null,
    } as never)

    await activateSubscription('sub_123')

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { planId: 'plan-2' },
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
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', suspendedReason: null, category: { commissionPercent: null },
    } as never)

    await suspendForPayment('sub_123')

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-local-1' }, data: { status: 'INACTIVE' } })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'SUSPENDED', suspendedReason: 'PAYMENT_OVERDUE' },
    })
  })

  it('never overrides an admin-imposed suspension', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-local-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', suspendedReason: 'ADMIN', category: { commissionPercent: null },
    } as never)

    await suspendForPayment('sub_123')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('never suspends a business whose category has commission billing enabled', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-local-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', suspendedReason: null, category: { commissionPercent: 10 },
    } as never)

    await suspendForPayment('sub_123')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})

describe('markCommissionInvoicePaid', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when the invoice does not exist', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)

    await markCommissionInvoicePaid('invoice-unknown')

    expect(prisma.commissionInvoice.update).not.toHaveBeenCalled()
    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('marks the invoice paid and lifts a commission-overdue suspension', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'COMMISSION_OVERDUE' } as never)

    await markCommissionInvoicePaid('invoice-1')

    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'ACTIVE', suspendedReason: null },
    })
  })

  it('marks the invoice paid without touching the business when it was not suspended for commission overdue', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: null } as never)

    await markCommissionInvoicePaid('invoice-1')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})

describe('markCommissionInvoiceOverdue', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when the invoice does not exist', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)

    await markCommissionInvoiceOverdue('invoice-unknown')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('marks the invoice overdue and suspends the business', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: null } as never)

    await markCommissionInvoiceOverdue('invoice-1')

    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({ where: { id: 'invoice-1' }, data: { status: 'OVERDUE' } })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'SUSPENDED', suspendedReason: 'COMMISSION_OVERDUE' },
    })
  })

  it('never overrides an admin-imposed suspension', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'ADMIN' } as never)

    await markCommissionInvoiceOverdue('invoice-1')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('never overrides an unrelated payment-overdue suspension', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'PAYMENT_OVERDUE' } as never)

    await markCommissionInvoiceOverdue('invoice-1')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})
