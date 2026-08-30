import { prisma } from '@/lib/db'
import { getAsaasPaymentInvoiceUrl } from '@/lib/asaas'

export type CommissionInvoiceRow = {
  id: string
  weekStart: Date
  weekEnd: Date
  salesCents: number
  percent: number
  feeCents: number
  status: string
  payUrl: string | null
}

export async function getCommissionInvoicesForBusiness(businessId: string): Promise<CommissionInvoiceRow[]> {
  const rows = await prisma.commissionInvoice.findMany({
    where: { businessId },
    orderBy: { weekStart: 'desc' },
  })

  return Promise.all(
    rows.map(async (row) => {
      let payUrl: string | null = null
      if ((row.status === 'PENDING' || row.status === 'OVERDUE') && row.asaasPaymentId) {
        try {
          payUrl = await getAsaasPaymentInvoiceUrl(row.asaasPaymentId)
        } catch {
          payUrl = null
        }
      }
      return {
        id: row.id,
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
        salesCents: row.salesCents,
        percent: row.percent,
        feeCents: row.feeCents,
        status: row.status,
        payUrl,
      }
    }),
  )
}
