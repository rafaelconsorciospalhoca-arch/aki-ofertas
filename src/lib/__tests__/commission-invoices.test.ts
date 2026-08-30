import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCommissionInvoicesForBusiness } from '@/lib/commission-invoices'
import { prisma } from '@/lib/db'
import { getAsaasPaymentInvoiceUrl } from '@/lib/asaas'

vi.mock('@/lib/db', () => ({
  prisma: { commissionInvoice: { findMany: vi.fn() } },
}))
vi.mock('@/lib/asaas', () => ({ getAsaasPaymentInvoiceUrl: vi.fn() }))

describe('getCommissionInvoicesForBusiness', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns an empty list when there are no invoices', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([])
    const result = await getCommissionInvoicesForBusiness('biz-1')
    expect(result).toEqual([])
  })

  it('resolves a pay url for a PENDING invoice', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'PENDING', asaasPaymentId: 'pay_123',
      },
    ] as never)
    vi.mocked(getAsaasPaymentInvoiceUrl).mockResolvedValue('https://sandbox.asaas.com/i/xyz')

    const result = await getCommissionInvoicesForBusiness('biz-1')

    expect(result).toEqual([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'PENDING', payUrl: 'https://sandbox.asaas.com/i/xyz',
      },
    ])
  })

  it('does not resolve a pay url for a PAID invoice', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'PAID', asaasPaymentId: 'pay_123',
      },
    ] as never)

    const result = await getCommissionInvoicesForBusiness('biz-1')

    expect(result[0].payUrl).toBeNull()
    expect(getAsaasPaymentInvoiceUrl).not.toHaveBeenCalled()
  })

  it('falls back to a null pay url when the Asaas lookup fails', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'OVERDUE', asaasPaymentId: 'pay_123',
      },
    ] as never)
    vi.mocked(getAsaasPaymentInvoiceUrl).mockRejectedValue(new Error('Asaas fora do ar'))

    const result = await getCommissionInvoicesForBusiness('biz-1')

    expect(result[0].payUrl).toBeNull()
  })
})
