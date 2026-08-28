import { prisma } from '@/lib/db'
import { distanceKm, formatDistance } from '@/lib/geo'
import { getRatingsForBusinesses, type Rating } from '@/lib/reviews'
import type { Coordinates, CityCookie } from '@/lib/location'

export type OfferRow = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  createdAt: Date
}

export type BusinessRow = {
  id: string
  name: string
  slug: string
  city: string
  state: string
  lat: number
  lng: number
}

export type OfferListItem = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  businessName: string
  businessSlug: string
  distanceKm: number | null
  distanceLabel: string | null
  rating: Rating | null
}

export function toOfferListItem(
  offer: OfferRow,
  business: BusinessRow,
  location: Coordinates | null,
  rating: Rating | null = null,
): OfferListItem {
  const km = location ? distanceKm(location, { lat: business.lat, lng: business.lng }) : null

  return {
    id: offer.id,
    slug: offer.slug,
    title: offer.title,
    imageUrl: offer.imageUrl,
    originalPrice: offer.originalPrice,
    discountPrice: offer.discountPrice,
    discountPercent: offer.discountPercent,
    businessName: business.name,
    businessSlug: business.slug,
    distanceKm: km,
    distanceLabel: km === null ? null : formatDistance(km),
    rating,
  }
}

export async function getFeaturedOffers(input: {
  location: Coordinates | null
  city?: CityCookie | null
  limit: number
}): Promise<OfferListItem[]> {
  const rows = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      business: {
        status: 'ACTIVE',
        owner: { blocked: false },
        ...(input.city ? { serviceCities: { some: { name: input.city.name, state: input.city.state } } } : {}),
      },
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: { business: { include: { plan: true } } },
  })

  const ratings = await getRatingsForBusinesses(Array.from(new Set(rows.map((row) => row.business.id))))
  const items = rows.map((row) => toOfferListItem(row, row.business, input.location, ratings.get(row.business.id) ?? null))
  const priceCentsByOfferId = new Map(rows.map((row) => [row.id, row.business.plan?.priceCents ?? 0]))

  items.sort((a, b) => {
    const planDiff = (priceCentsByOfferId.get(b.id) ?? 0) - (priceCentsByOfferId.get(a.id) ?? 0)
    if (planDiff !== 0) return planDiff
    if (input.location) return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    return 0
  })

  return items.slice(0, input.limit)
}

export async function getOffersList(input: {
  categoryId?: string
  location: Coordinates | null
  city?: CityCookie | null
  radiusKm?: number
  query?: string
}): Promise<OfferListItem[]> {
  const rows = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.query ? { title: { contains: input.query, mode: 'insensitive' } } : {}),
      business: {
        status: 'ACTIVE',
        owner: { blocked: false },
        ...(input.city ? { serviceCities: { some: { name: input.city.name, state: input.city.state } } } : {}),
      },
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: { business: true },
  })

  const ratings = await getRatingsForBusinesses(Array.from(new Set(rows.map((row) => row.business.id))))
  let items = rows.map((row) => toOfferListItem(row, row.business, input.location, ratings.get(row.business.id) ?? null))

  if (input.location) {
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  if (input.location && input.radiusKm !== undefined) {
    items = items.filter((item) => item.distanceKm !== null && item.distanceKm <= input.radiusKm!)
  }

  return items
}

export type OfferDetail = {
  id: string
  slug: string
  title: string
  description: string | null
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  quantityAvailable: number | null
  startDate: Date
  endDate: Date
  deliveryEnabled: boolean
  business: {
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
  }
}

export async function getOfferBySlug(slug: string): Promise<OfferDetail | null> {
  const row = await prisma.offer.findUnique({
    where: { slug },
    include: { business: { include: { owner: { select: { blocked: true } } } } },
  })

  if (!row) return null
  if (row.business.status !== 'ACTIVE' || row.business.owner.blocked) return null

  const now = new Date()
  if (row.startDate > now || row.endDate < now) return null

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    originalPrice: row.originalPrice,
    discountPrice: row.discountPrice,
    discountPercent: row.discountPercent,
    quantityAvailable: row.quantityAvailable,
    startDate: row.startDate,
    endDate: row.endDate,
    deliveryEnabled: row.deliveryEnabled,
    business: {
      name: row.business.name,
      slug: row.business.slug,
      whatsapp: row.business.whatsapp,
      city: row.business.city,
      state: row.business.state,
    },
  }
}
