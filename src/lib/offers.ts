import { prisma } from '@/lib/db'
import { distanceKm, formatDistance } from '@/lib/geo'
import { getRatingsForBusinesses, type Rating } from '@/lib/reviews'
import type { Coordinates, CityCookie } from '@/lib/location'
import type { PaymentMethod } from '@prisma/client'

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
      featured: true,
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

// Restaurants/lanchonetes get sorted first on the unfiltered home-page list
// during lunch (11:00-13:30) and dinner (from 17:00) hours, to drive demand
// for that segment when people are actually deciding where to eat. Outside
// those windows offers are left in their normal order — nothing is hidden.
const FOOD_CATEGORY_NAME = 'Restaurantes e Lanchonetes'

function isFoodPeakHour(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  const minutesSinceMidnight = hour * 60 + minute

  const lunchStart = 11 * 60
  const lunchEnd = 13 * 60 + 30
  const dinnerStart = 17 * 60

  return (minutesSinceMidnight >= lunchStart && minutesSinceMidnight <= lunchEnd) || minutesSinceMidnight >= dinnerStart
}

// Fisher-Yates — doesn't mutate the input array.
function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
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
    include: { business: true, category: { select: { name: true } } },
  })

  const ratings = await getRatingsForBusinesses(Array.from(new Set(rows.map((row) => row.business.id))))
  const foodOfferIds = new Set(rows.filter((row) => row.category.name === FOOD_CATEGORY_NAME).map((row) => row.id))
  let items = rows.map((row) => toOfferListItem(row, row.business, input.location, ratings.get(row.business.id) ?? null))

  // Without a location there's no meaningful ranking signal anyway (this used
  // to just be createdAt desc, always the same order) — shuffle so the same
  // handful of businesses don't permanently camp the top of the unfiltered
  // list; every visit gives a different set of merchants the top spot. Skip
  // this when a category/search filter is active, or when we do have a
  // location: proximity is a real signal worth keeping stable there.
  if (!input.location && !input.categoryId && !input.query) {
    items = shuffle(items)
  }

  if (input.location) {
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  if (input.location && input.radiusKm !== undefined) {
    items = items.filter((item) => item.distanceKm !== null && item.distanceKm <= input.radiusKm!)
  }

  // Only boost on the unfiltered home-page list — a merchant who already
  // picked a category or search term wants that result set, not a reshuffle.
  if (!input.categoryId && !input.query && isFoodPeakHour()) {
    items = [...items.filter((item) => foodOfferIds.has(item.id)), ...items.filter((item) => !foodOfferIds.has(item.id))]
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
  deliveryZones: { id: string; neighborhood: string; feeCents: number }[]
  optionGroups: {
    id: string
    name: string
    type: 'SINGLE' | 'MULTIPLE'
    required: boolean
    choices: { id: string; name: string; extraPriceCents: number }[]
  }[]
  business: {
    id: string
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
    acceptsPickup: boolean
    acceptedPaymentMethods: PaymentMethod[]
  }
}

export async function getOfferBySlug(slug: string): Promise<OfferDetail | null> {
  const row = await prisma.offer.findUnique({
    where: { slug },
    include: {
      business: {
        include: {
          owner: { select: { blocked: true } },
          deliveryZones: { where: { active: true }, orderBy: { neighborhood: 'asc' } },
        },
      },
      optionGroups: {
        include: { choices: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      },
    },
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
    deliveryZones: row.business.deliveryZones.map((zone) => ({
      id: zone.id,
      neighborhood: zone.neighborhood,
      feeCents: zone.feeCents,
    })),
    optionGroups: row.optionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      type: group.type,
      required: group.required,
      choices: group.choices.map((choice) => ({
        id: choice.id,
        name: choice.name,
        extraPriceCents: choice.extraPriceCents,
      })),
    })),
    business: {
      id: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
      whatsapp: row.business.whatsapp,
      city: row.business.city,
      state: row.business.state,
      acceptsPickup: row.business.acceptsPickup,
      acceptedPaymentMethods: row.business.acceptedPaymentMethods,
    },
  }
}
