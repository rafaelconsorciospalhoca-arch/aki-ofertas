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

  await prisma.review.upsert({
    where: { userId_businessId: { userId, businessId: business.id } },
    update: { rating, comment },
    create: { userId, businessId: business.id, rating, comment },
  })

  return { ok: true }
}
