import { prisma } from '@/lib/db'
import { toOfferListItem, type OfferListItem } from '@/lib/offers'
import { getRatingsForBusinesses } from '@/lib/reviews'
import type { BusinessSummary } from '@/lib/businesses'

export type FavoritesResult = { offers: OfferListItem[]; businesses: BusinessSummary[] }

export async function getFavoritesForUser(userId: string): Promise<FavoritesResult> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      offer: { include: { business: true } },
      business: { include: { category: true } },
    },
  })

  const businessIds = Array.from(
    new Set(
      rows
        .map((row) => row.offer?.businessId ?? row.business?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const ratings = await getRatingsForBusinesses(businessIds)

  const offers: OfferListItem[] = []
  const businesses: BusinessSummary[] = []

  for (const row of rows) {
    if (row.offer && row.offer.status === 'ACTIVE' && row.offer.business.status === 'ACTIVE') {
      offers.push(toOfferListItem(row.offer, row.offer.business, null, ratings.get(row.offer.businessId) ?? null))
    } else if (row.business && row.business.status === 'ACTIVE') {
      businesses.push({
        id: row.business.id,
        slug: row.business.slug,
        name: row.business.name,
        logoUrl: row.business.logoUrl,
        categoryName: row.business.category.name,
        city: row.business.city,
        state: row.business.state,
        rating: ratings.get(row.business.id) ?? null,
      })
    }
  }

  return { offers, businesses }
}

export type FavoriteTarget = { offerId: string; businessId?: undefined } | { businessId: string; offerId?: undefined }

export async function toggleFavorite(userId: string, target: FavoriteTarget): Promise<{ favorited: boolean }> {
  const existing = await prisma.favorite.findFirst({
    where: { userId, offerId: target.offerId ?? null, businessId: target.businessId ?? null },
  })

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } })
    return { favorited: false }
  }

  await prisma.favorite.create({
    data: { userId, offerId: target.offerId ?? null, businessId: target.businessId ?? null },
  })
  return { favorited: true }
}
