import { prisma } from '@/lib/db'
import { createAsaasCustomer, createAsaasCharge } from '@/lib/asaas'

export function getPreviousWeekWindow(now: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const day = now.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday))
  const weekStart = new Date(thisMonday)
  weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  return { weekStart, weekEnd: thisMonday }
}

export function calculateCommissionFee(salesCents: number, percent: number): number {
  return Math.round((salesCents * percent) / 100)
}

export type GenerateInvoicesResult = { created: number; skipped: number; failed: number }

export async function generateWeeklyCommissionInvoices(now: Date = new Date()): Promise<GenerateInvoicesResult> {
  const { weekStart, weekEnd } = getPreviousWeekWindow(now)

  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE', category: { commissionPercent: { not: null } } },
    include: { category: true, owner: true },
  })

  let created = 0
  let skipped = 0
  let failed = 0

  for (const business of businesses) {
    const percent = business.category.commissionPercent
    if (percent === null) {
      skipped++
      continue
    }

    const existing = await prisma.commissionInvoice.findUnique({
      where: { businessId_weekStart: { businessId: business.id, weekStart } },
    })
    if (existing) {
      skipped++
      continue
    }

    const orders = await prisma.order.findMany({
      where: { businessId: business.id, createdAt: { gte: weekStart, lt: weekEnd }, status: { not: 'CANCELLED' } },
      select: { quantity: true, offer: { select: { discountPrice: true } } },
    })
    const salesCents = orders.reduce((sum, order) => sum + order.offer.discountPrice * order.quantity, 0)
    if (salesCents === 0) {
      skipped++
      continue
    }

    const feeCents = calculateCommissionFee(salesCents, percent)

    try {
      let asaasCustomerId = business.asaasCustomerId
      if (!asaasCustomerId) {
        asaasCustomerId = await createAsaasCustomer({
          name: business.owner.name,
          cpfCnpj: business.document ?? '',
          email: business.email ?? business.owner.email,
          mobilePhone: business.whatsapp ?? '',
          externalReference: business.id,
        })
        await prisma.business.update({ where: { id: business.id }, data: { asaasCustomerId } })
      }

      const invoice = await prisma.commissionInvoice.create({
        data: { businessId: business.id, weekStart, weekEnd, salesCents, percent, feeCents, dueDate: weekEnd, status: 'PENDING' },
      })

      const { paymentId } = await createAsaasCharge({
        customerId: asaasCustomerId,
        value: feeCents / 100,
        description: `Comissão semanal (${percent}%) — ${weekStart.toLocaleDateString('pt-BR')} a ${weekEnd.toLocaleDateString('pt-BR')}`,
        externalReference: invoice.id,
        dueDate: weekEnd,
      })

      await prisma.commissionInvoice.update({ where: { id: invoice.id }, data: { asaasPaymentId: paymentId } })
      created++
    } catch (err) {
      console.error('generateWeeklyCommissionInvoices failed for business', business.id, err)
      failed++
    }
  }

  return { created, skipped, failed }
}
