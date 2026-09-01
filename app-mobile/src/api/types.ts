export type Rating = { average: number; count: number }

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'FOOD_VOUCHER' | 'MEAL_VOUCHER' | 'CASH'

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
  phone: string | null
}

export type BusinessSummary = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  categoryName: string
  city: string
  state: string
  rating: Rating | null
}

export type FavoritesResult = { offers: OfferListItem[]; businesses: BusinessSummary[] }

export type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  reviewerName: string
}

export type ReviewsSummary = { average: number | null; count: number; reviews: ReviewRow[] }

export type MenuItemRow = {
  id: string
  name: string
  description: string | null
  price: number | null
  imageUrl: string | null
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'

export type OrderRow = {
  id: string
  quantity: number
  phone: string
  address: string
  number: string | null
  neighborhood: string | null
  deliveryFeeCents: number | null
  optionsFeeCents: number | null
  paymentMethod: PaymentMethod
  changeForCents: number | null
  city: string
  state: string
  zip: string | null
  notes: string | null
  status: OrderStatus
  createdAt: string
  offerId: string
  offerTitle: string
  offerSlug: string
  discountPrice: number
  businessId: string
  businessName: string
  businessSlug: string
  customerName: string
}

export type CreateOrderInput = {
  offerId: string
  quantity: number
  phone: string
  address: string
  number?: string
  deliveryZoneId: string
  city: string
  state: string
  zip?: string
  notes?: string
  selectedChoiceIds?: string[]
  paymentMethod: PaymentMethod
  changeForCents?: number
}
