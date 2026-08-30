import { prisma } from '@/lib/db'
import { createAsaasCustomer, createAsaasCharge } from '@/lib/asaas'
import { getEffectiveCommissionPercent } from '@/lib/commission'

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

const MIN_INVOICE_FEE_CENTS = 500

export type GenerateInvoicesResult = { created: number; skipped: number; failed: number }

export async function generateWeeklyCommissionInvoices(now: Date = new Date()): Promise<GenerateInvoicesResult> {
  const { weekStart, weekEnd } = getPreviousWeekWindow(now)

  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE' },
    include: { category: true, owner: true },
  })

  let created = 0
  let skipped = 0
  let failed = 0

  for (const business of businesses) {
    const percent = getEffectiveCommissionPercent(business)
    if (percent === null) {
      // A dangling ACCUMULATING row from before this business became exempt must be closed out:
      // otherwise a later re-enable would resume it via the findFirst below, using its stale
      // weekStart as periodStart and sweeping the entire exempt period into one retroactive charge.
      const dangling = await prisma.commissionInvoice.findFirst({
        where: { businessId: business.id, status: 'ACCUMULATING' },
      })
      if (dangling) {
        await prisma.commissionInvoice.delete({ where: { id: dangling.id } })
      }
      skipped++
      continue
    }

    const lastInvoice = await prisma.commissionInvoice.findFirst({
      where: { businessId: business.id },
      orderBy: { weekEnd: 'desc' },
    })

    // An ACCUMULATING row is a durable marker for a period whose commission has not yet
    // reached the minimum. While it exists we keep its ORIGINAL weekStart so the uninvoiced
    // sales are carried forward instead of being silently discarded each run.
    const accumulatingId = lastInvoice?.status === 'ACCUMULATING' ? lastInvoice.id : null
    const periodStart = accumulatingId ? lastInvoice!.weekStart : (lastInvoice?.weekEnd ?? weekStart)

    if (!accumulatingId) {
      const existing = await prisma.commissionInvoice.findUnique({
        where: { businessId_weekStart: { businessId: business.id, weekStart: periodStart } },
      })
      if (existing) {
        skipped++
        continue
      }
    }

    const orders = await prisma.order.findMany({
      where: { businessId: business.id, createdAt: { gte: periodStart, lt: weekEnd }, status: { not: 'CANCELLED' } },
      select: { quantity: true, offer: { select: { discountPrice: true } } },
    })
    const salesCents = orders.reduce((sum, order) => sum + order.offer.discountPrice * order.quantity, 0)

    const feeCents = calculateCommissionFee(salesCents, percent)
    if (feeCents < MIN_INVOICE_FEE_CENTS) {
      if (accumulatingId) {
        // Extend the existing marker: same weekStart/status, new end date and running totals.
        await prisma.commissionInvoice.update({
          where: { id: accumulatingId },
          data: { weekEnd, salesCents, feeCents },
        })
      } else {
        await prisma.commissionInvoice.create({
          data: {
            businessId: business.id,
            weekStart: periodStart,
            weekEnd,
            salesCents,
            percent,
            feeCents,
            dueDate: weekEnd,
            status: 'ACCUMULATING',
          },
        })
      }
      skipped++
      continue
    }

    let invoiceId: string | undefined
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

      if (accumulatingId) {
        // Promote the accumulating marker in place into a real charge.
        await prisma.commissionInvoice.update({
          where: { id: accumulatingId },
          data: { weekEnd, salesCents, feeCents, percent, dueDate: weekEnd, status: 'PENDING' },
        })
        invoiceId = accumulatingId
      } else {
        const invoice = await prisma.commissionInvoice.create({
          data: {
            businessId: business.id,
            weekStart: periodStart,
            weekEnd,
            salesCents,
            percent,
            feeCents,
            dueDate: weekEnd,
            status: 'PENDING',
          },
        })
        invoiceId = invoice.id
      }

      const { paymentId } = await createAsaasCharge({
        customerId: asaasCustomerId,
        value: feeCents / 100,
        description: `Comissão semanal (${percent}%) — ${periodStart.toLocaleDateString('pt-BR')} a ${weekEnd.toLocaleDateString('pt-BR')}`,
        externalReference: invoiceId,
        dueDate: weekEnd,
      })

      await prisma.commissionInvoice.update({ where: { id: invoiceId }, data: { asaasPaymentId: paymentId } })
      created++
    } catch (err) {
      console.error('generateWeeklyCommissionInvoices failed for business', business.id, err)
      if (invoiceId) {
        // Revert to the accumulating marker rather than deleting the row: deleting would lose
        // the accumulated period start and silently discard the merchant's uninvoiced sales.
        try {
          await prisma.commissionInvoice.update({
            where: { id: invoiceId },
            data: { status: 'ACCUMULATING', asaasPaymentId: null },
          })
        } catch (revertErr) {
          console.error('generateWeeklyCommissionInvoices failed to revert invoice after error', invoiceId, revertErr)
        }
      }
      failed++
    }
  }

  return { created, skipped, failed }
}
