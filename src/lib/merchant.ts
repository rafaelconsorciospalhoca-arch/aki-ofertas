import { prisma } from '@/lib/db'

export async function getBusinessForOwner(ownerId: string) {
  return prisma.business.findFirst({
    where: { ownerId },
    include: { category: true },
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
