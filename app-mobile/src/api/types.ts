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

export type Category = { id: string; name: string; icon: string; order: number }

export type City = { id: string; name: string; state: string }

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
  startDate: string
  endDate: string
  business: {
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
  }
}

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

export type CouponRow = {
  id: string
  code: string
  status: 'VALID' | 'USED' | 'EXPIRED'
  generatedAt: string
  usedAt: string | null
  expiresAt: string
  offerId: string
  offerTitle: string
  offerSlug: string
  businessName: string
  businessSlug: string
}

export type Profile = {
  id: string
  name: string
  email: string
  city: string | null
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

export type FavoritesResult = { offers: OfferListItem[]; businesses: BusinessSummary[] }
