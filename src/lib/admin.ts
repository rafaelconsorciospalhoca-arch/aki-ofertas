import { prisma } from '@/lib/db'
import type { BusinessStatus } from '@prisma/client'

export async function getPlatformStats() {
  const [totalUsers, totalBusinesses, pendingBusinesses, activeBusinesses, totalOffers, totalCities] =
    await Promise.all([
      prisma.user.count(),
      prisma.business.count(),
      prisma.business.count({ where: { status: 'PENDING' } }),
      prisma.business.count({ where: { status: 'ACTIVE' } }),
      prisma.offer.count(),
      prisma.city.count(),
    ])

  return { totalUsers, totalBusinesses, pendingBusinesses, activeBusinesses, totalOffers, totalCities }
}

export async function getBusinessesForAdmin(status?: BusinessStatus) {
  return prisma.business.findMany({
    where: status ? { status } : {},
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getAllCategories() {
  return prisma.category.findMany({ orderBy: { order: 'asc' } })
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } })
}

export async function getAllCities() {
  return prisma.city.findMany({ orderBy: { name: 'asc' } })
}

export async function getCityById(id: string) {
  return prisma.city.findUnique({ where: { id } })
}
