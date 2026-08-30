import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPreviousWeekWindow, calculateCommissionFee, generateWeeklyCommissionInvoices } from '@/lib/weekly-commission'
import { prisma } from '@/lib/db'
import { createAsaasCustomer, createAsaasCharge } from '@/lib/asaas'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findMany: vi.fn(), update: vi.fn() },
    commissionInvoice: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    order: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/asaas', () => ({
  createAsaasCustomer: vi.fn(),
  createAsaasCharge: vi.fn(),
}))

describe('getPreviousWeekWindow', () => {
  it('returns the full previous Monday-to-Monday week for a Monday "now"', () => {
    // 2026-08-31 is a Monday
    const result = getPreviousWeekWindow(new Date('2026-08-31T06:00:00Z'))
    expect(result).toEqual({
      weekStart: new Date('2026-08-24T00:00:00Z'),
      weekEnd: new Date('2026-08-31T00:00:00Z'),
    })
  })

  it('returns the same window regardless of the day of week "now" falls on', () => {
    // 2026-09-02 is a Wednesday, still inside the week that started 2026-08-31
    const result = getPreviousWeekWindow(new Date('2026-09-02T12:00:00Z'))
    expect(result).toEqual({
      weekStart: new Date('2026-08-24T00:00:00Z'),
      weekEnd: new Date('2026-08-31T00:00:00Z'),
    })
  })
})

describe('calculateCommissionFee', () => {
  it('rounds to the nearest cent', () => {
    expect(calculateCommissionFee(9999, 10)).toBe(1000)
    expect(calculateCommissionFee(333, 10)).toBe(33)
    expect(calculateCommissionFee(335, 10)).toBe(34)
  })
})

const commissionBusiness = {
  id: 'biz-1',
  asaasCustomerId: 'cus_existing',
  document: '12345678900',
  email: null,
  whatsapp: '5546999990000',
  category: { commissionPercent: 10 },
  owner: { name: 'João', email: 'joao@x.com' },
  commissionOverrideEnabled: false,
  commissionOverridePercent: null,
}

describe('generateWeeklyCommissionInvoices', () => {
  afterEach(() => vi.clearAllMocks())

  it('skips a business that already has an invoice for the week', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'existing-invoice' } as never)

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(prisma.order.findMany).not.toHaveBeenCalled()
  })

  it('skips a business with zero sales in the week, without charging anything', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([])

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(createAsaasCharge).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'ACCUMULATING', salesCents: 0, feeCents: 0 }),
    })
  })

  it('creates an ACCUMULATING marker when the fee is still below the R$5,00 minimum', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ offer: { discountPrice: 3000 }, quantity: 1 }] as never)

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(createAsaasCharge).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.create).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        weekStart: new Date('2026-08-24T00:00:00Z'),
        weekEnd: new Date('2026-08-31T00:00:00Z'),
        salesCents: 3000,
        percent: 10,
        feeCents: 300,
        dueDate: new Date('2026-08-31T00:00:00Z'),
        status: 'ACCUMULATING',
      },
    })
  })

  it('accumulates from the last invoice weekEnd when the new period crosses the minimum', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue({
      id: 'invoice-old',
      status: 'PAID',
      weekStart: new Date('2026-08-10T00:00:00Z'),
      weekEnd: new Date('2026-08-17T00:00:00Z'),
    } as never)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ offer: { discountPrice: 10000 }, quantity: 1 }] as never)
    vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)
    vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_123' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 })
    expect(prisma.commissionInvoice.findUnique).toHaveBeenCalledWith({
      where: { businessId_weekStart: { businessId: 'biz-1', weekStart: new Date('2026-08-17T00:00:00Z') } },
    })
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-08-17T00:00:00Z'), lt: new Date('2026-08-31T00:00:00Z') },
        }),
      }),
    )
    expect(prisma.commissionInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        weekStart: new Date('2026-08-17T00:00:00Z'),
        weekEnd: new Date('2026-08-31T00:00:00Z'),
      }),
    })
  })

  it('creates an invoice and an Asaas charge, reusing an existing Asaas customer id', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      { offer: { discountPrice: 5000 }, quantity: 2 },
      { offer: { discountPrice: 3000 }, quantity: 1 },
    ] as never)
    vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)
    vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_123' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 })
    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.create).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        weekStart: new Date('2026-08-24T00:00:00Z'),
        weekEnd: new Date('2026-08-31T00:00:00Z'),
        salesCents: 13000,
        percent: 10,
        feeCents: 1300,
        dueDate: new Date('2026-08-31T00:00:00Z'),
        status: 'PENDING',
      },
    })
    expect(createAsaasCharge).toHaveBeenCalledWith({
      customerId: 'cus_existing',
      value: 13,
      description: expect.stringContaining('10%'),
      externalReference: 'invoice-1',
      dueDate: new Date('2026-08-31T00:00:00Z'),
    })
    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { asaasPaymentId: 'pay_123' },
    })
  })

  it('creates an Asaas customer first when the business has none yet', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { ...commissionBusiness, asaasCustomerId: null },
    ] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ offer: { discountPrice: 10000 }, quantity: 1 }] as never)
    vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)
    vi.mocked(createAsaasCustomer).mockResolvedValue('cus_new')
    vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_123' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 })
    expect(createAsaasCustomer).toHaveBeenCalledWith({
      name: 'João', cpfCnpj: '12345678900', email: 'joao@x.com', mobilePhone: '5546999990000', externalReference: 'biz-1',
    })
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz-1' }, data: { asaasCustomerId: 'cus_new' } })
  })

  it('counts a business as failed and continues to the next one when the Asaas call throws', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness, { ...commissionBusiness, id: 'biz-2' }] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ offer: { discountPrice: 10000 }, quantity: 1 }] as never)
    vi.mocked(prisma.commissionInvoice.create)
      .mockResolvedValueOnce({ id: 'invoice-1' } as never)
      .mockResolvedValueOnce({ id: 'invoice-2' } as never)
    vi.mocked(createAsaasCharge).mockRejectedValueOnce(new Error('Asaas fora do ar')).mockResolvedValueOnce({ paymentId: 'pay_456' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 1 })
    // The row is reverted to the accumulating marker, never deleted — deleting would lose the period.
    expect(prisma.commissionInvoice.delete).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { status: 'ACCUMULATING', asaasPaymentId: null },
    })
  })

  it('carries a below-minimum period forward across weeks instead of resetting it (regression)', async () => {
    // Run 1: no invoice at all yet, R$30 of sales -> R$3,00 fee, below the R$5,00 minimum.
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ offer: { discountPrice: 3000 }, quantity: 1 }] as never)
    vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)

    const run1 = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(run1).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(prisma.commissionInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        weekStart: new Date('2026-08-24T00:00:00Z'),
        status: 'ACCUMULATING',
      }),
    })
    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(createAsaasCharge).not.toHaveBeenCalled()

    vi.clearAllMocks()

    // Run 2, one week later: the ACCUMULATING marker from run 1 is now the latest invoice.
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue({
      id: 'invoice-1',
      status: 'ACCUMULATING',
      weekStart: new Date('2026-08-24T00:00:00Z'),
      weekEnd: new Date('2026-08-31T00:00:00Z'),
    } as never)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ offer: { discountPrice: 3000 }, quantity: 3 }] as never)
    vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_789' })

    const run2 = await generateWeeklyCommissionInvoices(new Date('2026-09-07T06:00:00Z'))

    expect(run2).toEqual({ created: 1, skipped: 0, failed: 0 })
    // The period did NOT reset to run 2's own Monday (2026-08-31) — it kept run 1's start.
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-08-24T00:00:00Z'), lt: new Date('2026-09-07T00:00:00Z') },
        }),
      }),
    )
    // The duplicate guard is skipped while continuing an accumulating row.
    expect(prisma.commissionInvoice.findUnique).not.toHaveBeenCalled()
    // The existing row is promoted in place, not duplicated.
    expect(prisma.commissionInvoice.create).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: {
        weekEnd: new Date('2026-09-07T00:00:00Z'),
        salesCents: 9000,
        feeCents: 900,
        percent: 10,
        dueDate: new Date('2026-09-07T00:00:00Z'),
        status: 'PENDING',
      },
    })
    expect(createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: 'invoice-1', value: 9 }),
    )
  })

  it('extends an ongoing ACCUMULATING row that is still below the minimum', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue({
      id: 'invoice-1',
      status: 'ACCUMULATING',
      weekStart: new Date('2026-08-24T00:00:00Z'),
      weekEnd: new Date('2026-08-31T00:00:00Z'),
    } as never)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ offer: { discountPrice: 2000 }, quantity: 2 }] as never)

    const result = await generateWeeklyCommissionInvoices(new Date('2026-09-07T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(prisma.commissionInvoice.create).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.delete).not.toHaveBeenCalled()
    expect(createAsaasCharge).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: {
        weekEnd: new Date('2026-09-07T00:00:00Z'),
        salesCents: 4000,
        feeCents: 400,
      },
    })
  })

  it('deletes a dangling ACCUMULATING row when the business becomes exempt (regression)', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { ...commissionBusiness, commissionOverrideEnabled: true, commissionOverridePercent: null },
    ] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue({
      id: 'invoice-stale',
      status: 'ACCUMULATING',
      weekStart: new Date('2026-06-01T00:00:00Z'),
      weekEnd: new Date('2026-06-08T00:00:00Z'),
    } as never)

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(prisma.commissionInvoice.delete).toHaveBeenCalledWith({ where: { id: 'invoice-stale' } })
    expect(prisma.order.findMany).not.toHaveBeenCalled()
    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(createAsaasCharge).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.create).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.update).not.toHaveBeenCalled()
  })

  it('does nothing extra for an exempt business with no dangling ACCUMULATING row', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { ...commissionBusiness, commissionOverrideEnabled: true, commissionOverridePercent: null },
    ] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(prisma.commissionInvoice.delete).not.toHaveBeenCalled()
    expect(prisma.order.findMany).not.toHaveBeenCalled()
  })

  it('uses a business-level override percent instead of the category default', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { ...commissionBusiness, commissionOverrideEnabled: true, commissionOverridePercent: 20 },
    ] as never)
    vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ discountPrice: 10000, quantity: 1, offer: { discountPrice: 10000 } }] as never)
    vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)
    vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_123' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 })
    expect(prisma.commissionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ percent: 20, feeCents: 2000 }) }),
    )
  })
})
