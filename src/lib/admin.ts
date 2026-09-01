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

export async function getBusinessById(id: string) {
  return prisma.business.findUnique({
    where: { id },
    include: { category: true, owner: { select: { name: true, email: true } } },
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

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  city: true,
  state: true,
  blocked: true,
  createdAt: true,
} as const

export async function getUsersForAdmin(query?: string) {
  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {},
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: userSelect })
}

export async function getOffersForAdmin(query?: string) {
  return prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' as const } },
              { business: { name: { contains: query, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    include: { business: { select: { name: true, city: true, state: true } } },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getAllPlans() {
  return prisma.plan.findMany({ orderBy: { priceCents: 'asc' } })
}

export async function getPlanById(id: string) {
  return prisma.plan.findUnique({ where: { id } })
}
