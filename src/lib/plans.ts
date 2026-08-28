import { prisma } from '@/lib/db'

export async function getPaidPlans() {
  return prisma.plan.findMany({
    where: { priceCents: { gt: 0 } },
    orderBy: { priceCents: 'asc' },
  })
}
