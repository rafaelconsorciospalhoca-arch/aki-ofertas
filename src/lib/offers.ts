import { prisma } from '@/lib/db'
import { distanceKm, formatDistance } from '@/lib/geo'
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
}

export function toOfferListItem(
  offer: OfferRow,
  business: BusinessRow,
  location: Coordinates | null,
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
        ...(input.city ? { city: input.city.name, state: input.city.state } : {}),
      },
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: { business: true },
  })

  const items = rows.map((row) => toOfferListItem(row, row.business, input.location))

  if (input.location) {
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  return items.slice(0, input.limit)
}

export async function getOffersList(input: {
  categoryId?: string
  location: Coordinates | null
  city?: CityCookie | null
  radiusKm?: number
}): Promise<OfferListItem[]> {
  const rows = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      business: {
        status: 'ACTIVE',
        owner: { blocked: false },
        ...(input.city ? { city: input.city.name, state: input.city.state } : {}),
      },
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: { business: true },
  })

  let items = rows.map((row) => toOfferListItem(row, row.business, input.location))

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
    include: { business: { include: { owner: true } } },
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
    business: {
      name: row.business.name,
      slug: row.business.slug,
      whatsapp: row.business.whatsapp,
      city: row.business.city,
      state: row.business.state,
    },
  }
}
