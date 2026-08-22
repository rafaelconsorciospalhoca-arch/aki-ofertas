import { prisma } from '@/lib/db'

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
  })
}

export async function getActiveCities() {
  return prisma.city.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
}
