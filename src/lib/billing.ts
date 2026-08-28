import { prisma } from '@/lib/db'

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

  const business = await prisma.business.findUnique({ where: { id: subscription.businessId } })
  if (business?.suspendedReason === 'ADMIN') return

  await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'INACTIVE' } })
  await prisma.business.update({
    where: { id: subscription.businessId },
    data: { status: 'SUSPENDED', suspendedReason: 'PAYMENT_OVERDUE' },
  })
}
