import { prisma } from '@/lib/db'

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, icon: true, order: true },
  })
}

export async function getActiveCities() {
  return prisma.city.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, state: true },
  })
}
