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
    },
  })

  if (!row) return null
  if (row.status !== 'ACTIVE') return null

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
