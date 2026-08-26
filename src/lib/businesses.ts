import { prisma } from '@/lib/db'
import { toOfferListItem, type OfferListItem } from '@/lib/offers'

export type BusinessDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  categoryName: string
  city: string
  state: string
  phone: string | null
  whatsapp: string | null
  offers: OfferListItem[]
}

export async function getBusinessBySlug(slug: string): Promise<BusinessDetail | null> {
  const row = await prisma.business.findUnique({
    where: { slug },
    include: {
      category: true,
      offers: { where: { status: 'ACTIVE' } },
      owner: { select: { blocked: true } },
    },
  })

  if (!row) return null
  if (row.status !== 'ACTIVE' || row.owner.blocked) return null

  const businessRow = { id: row.id, name: row.name, slug: row.slug, city: row.city, state: row.state, lat: row.lat, lng: row.lng }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    categoryName: row.category.name,
    city: row.city,
    state: row.state,
    phone: row.phone,
    whatsapp: row.whatsapp,
    offers: row.offers.map((offer) => toOfferListItem(offer, businessRow, null)),
  }
}

export type BusinessSummary = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  categoryName: string
  city: string
  state: string
}

export async function searchBusinesses(query: string): Promise<BusinessSummary[]> {
  const rows = await prisma.business.findMany({
    where: {
      status: 'ACTIVE',
      owner: { blocked: false },
      name: { contains: query, mode: 'insensitive' },
    },
    include: { category: true },
    orderBy: { name: 'asc' },
    take: 20,
  })

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    categoryName: row.category.name,
    city: row.city,
    state: row.state,
  }))
}
