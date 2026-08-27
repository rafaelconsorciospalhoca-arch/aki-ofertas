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

/**
 * Cities that actually have an active business, for marketing surfaces that
 * want to show real coverage — as opposed to getActiveCities(), which reads
 * the City table used for signup/onboarding and can include cities marked
 * active (or comingSoon) with no business in them yet.
 */
export async function getCitiesWithActiveBusinesses(): Promise<{ name: string; state: string }[]> {
  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE' },
    select: { city: true, state: true },
    distinct: ['city', 'state'],
  })
  return businesses
    .map((b) => ({ name: b.city, state: b.state }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
