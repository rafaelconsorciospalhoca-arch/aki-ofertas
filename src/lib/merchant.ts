import { prisma } from '@/lib/db'

export async function getBusinessForOwner(ownerId: string) {
  return prisma.business.findFirst({
    where: { ownerId },
    include: { category: true, serviceCities: { select: { id: true, name: true, state: true } } },
  })
}

export async function getMyOffers(businessId: string) {
  return prisma.offer.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOfferForOwner(id: string, businessId: string) {
  return prisma.offer.findFirst({
    where: { id, businessId },
  })
}

export async function getMenuItemsForOwner(businessId: string) {
  return prisma.menuItem.findMany({
    where: { businessId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function getDeliveryZonesForOwner(businessId: string) {
  return prisma.deliveryZone.findMany({
    where: { businessId },
    orderBy: { neighborhood: 'asc' },
  })
}
