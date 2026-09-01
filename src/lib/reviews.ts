import { prisma } from '@/lib/db'

export type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  createdAt: Date
  reviewerName: string
}

export type ReviewsSummary = {
  average: number | null
  count: number
  reviews: ReviewRow[]
}

/** First name + last initial, e.g. "Rafael C." — keeps reviewer identity light. */
function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export async function getReviewsForBusinessSlug(slug: string): Promise<ReviewsSummary | null> {
  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } })
  if (!business) return null

  const [aggregate, rows] = await Promise.all([
    prisma.review.aggregate({ where: { businessId: business.id }, _avg: { rating: true }, _count: true }),
    prisma.review.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    }),
  ])

  return {
    average: aggregate._avg.rating,
    count: aggregate._count,
    reviews: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
      reviewerName: displayName(row.user.name),
    })),
  }
}

export type Rating = { average: number; count: number }

/** Batch average rating per business, for list views where a query per card would be N+1. */
export async function getRatingsForBusinesses(businessIds: string[]): Promise<Map<string, Rating>> {
  if (businessIds.length === 0) return new Map()

  const groups = await prisma.review.groupBy({
    by: ['businessId'],
    where: { businessId: { in: businessIds } },
    _avg: { rating: true },
    _count: true,
  })

  const map = new Map<string, Rating>()
  for (const group of groups) {
    if (group._avg.rating !== null) {
      map.set(group.businessId, { average: group._avg.rating, count: group._count })
    }
  }
  return map
}

// A used coupon or a non-cancelled order is the customer's proof they actually
// interacted with this business — without this gate anyone could rate a
// business they never bought from.
async function hasEngagedWithBusiness(userId: string, businessId: string): Promise<boolean> {
  const [usedCoupon, order] = await Promise.all([
    prisma.coupon.findFirst({ where: { userId, businessId, status: 'USED' }, select: { id: true } }),
    prisma.order.findFirst({ where: { userId, businessId, status: { not: 'CANCELLED' } }, select: { id: true } }),
  ])
  return Boolean(usedCoupon || order)
}

export type ReviewResult = { ok: true } | { ok: false; error: string }

export async function upsertReviewForBusinessSlug(
  userId: string,
  slug: string,
  rating: number,
  comment: string | null,
): Promise<ReviewResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'A nota precisa ser de 1 a 5.' }
  }

  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true, status: true } })
  if (!business || business.status !== 'ACTIVE') {
    return { ok: false, error: 'Loja não encontrada.' }
  }

  if (!(await hasEngagedWithBusiness(userId, business.id))) {
    return { ok: false, error: 'Você precisa ter usado um cupom ou feito um pedido nesta loja para avaliar.' }
  }

  await prisma.review.upsert({
    where: { userId_businessId: { userId, businessId: business.id } },
    update: { rating, comment },
    create: { userId, businessId: business.id, rating, comment },
  })

  return { ok: true }
}
