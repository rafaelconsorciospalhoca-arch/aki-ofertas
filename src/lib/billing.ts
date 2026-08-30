import { prisma } from '@/lib/db'
import { getEffectiveCommissionPercent } from '@/lib/commission'

export async function activateSubscription(asaasSubscriptionId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({ where: { asaasSubscriptionId } })
  if (!subscription) return

  await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'ACTIVE' } })

  const business = await prisma.business.findUnique({ where: { id: subscription.businessId } })
  const canLiftSuspension =
    business?.status === 'SUSPENDED' &&
    (business?.suspendedReason === 'TRIAL_EXPIRED' || business?.suspendedReason === 'PAYMENT_OVERDUE')

  if (!canLiftSuspension) {
    await prisma.business.update({ where: { id: subscription.businessId }, data: { planId: subscription.planId } })
    return
  }

  await prisma.business.update({
    where: { id: subscription.businessId },
    data: { planId: subscription.planId, status: 'ACTIVE', suspendedReason: null },
  })
}

export async function suspendForPayment(asaasSubscriptionId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({ where: { asaasSubscriptionId } })
  if (!subscription) return

  const business = await prisma.business.findUnique({
    where: { id: subscription.businessId },
    include: { category: true },
  })
  if (business?.suspendedReason === 'ADMIN') return
  if (business && getEffectiveCommissionPercent(business) !== null) return

  await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'INACTIVE' } })
  await prisma.business.update({
    where: { id: subscription.businessId },
    data: { status: 'SUSPENDED', suspendedReason: 'PAYMENT_OVERDUE' },
  })
}

export async function markCommissionInvoicePaid(invoiceId: string): Promise<void> {
  const invoice = await prisma.commissionInvoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  await prisma.commissionInvoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date() } })

  const business = await prisma.business.findUnique({ where: { id: invoice.businessId } })
  if (business?.suspendedReason === 'COMMISSION_OVERDUE') {
    await prisma.business.update({ where: { id: invoice.businessId }, data: { status: 'ACTIVE', suspendedReason: null } })
  }
}

export async function markCommissionInvoiceOverdue(invoiceId: string): Promise<void> {
  const invoice = await prisma.commissionInvoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  // The invoice is overdue as a matter of fact, regardless of the business's suspension state.
  await prisma.commissionInvoice.update({ where: { id: invoiceId }, data: { status: 'OVERDUE' } })

  // Only the business-suspension write is gated: never override a suspension imposed for another reason.
  const business = await prisma.business.findUnique({ where: { id: invoice.businessId } })
  if (business?.suspendedReason && business.suspendedReason !== 'COMMISSION_OVERDUE') return

  await prisma.business.update({
    where: { id: invoice.businessId },
    data: { status: 'SUSPENDED', suspendedReason: 'COMMISSION_OVERDUE' },
  })
}
