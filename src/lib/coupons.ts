import { prisma } from '@/lib/db'
import type { CouponStatus } from '@prisma/client'

export type CouponRow = {
  id: string
  code: string
  status: 'VALID' | 'USED' | 'EXPIRED'
  generatedAt: Date
  usedAt: Date | null
  expiresAt: Date
  offerId: string
  offerTitle: string
  offerSlug: string
  businessName: string
  businessSlug: string
}

type CouponWithRelations = {
  id: string
  code: string
  status: CouponStatus
  generatedAt: Date
  usedAt: Date | null
  expiresAt: Date
  offerId: string
  offer: { title: string; slug: string }
  business: { name: string; slug: string }
}

function toCouponRow(row: CouponWithRelations): CouponRow {
  const now = new Date()
  const status: CouponRow['status'] =
    row.status === 'USED' ? 'USED' : row.expiresAt < now ? 'EXPIRED' : 'VALID'

  return {
    id: row.id,
    code: row.code,
    status,
    generatedAt: row.generatedAt,
    usedAt: row.usedAt,
    expiresAt: row.expiresAt,
    offerId: row.offerId,
    offerTitle: row.offer.title,
    offerSlug: row.offer.slug,
    businessName: row.business.name,
    businessSlug: row.business.slug,
  }
}

const couponInclude = {
  offer: { select: { title: true, slug: true } },
  business: { select: { name: true, slug: true } },
} as const

export async function getCouponsForUser(userId: string): Promise<CouponRow[]> {
  const rows = await prisma.coupon.findMany({
    where: { userId },
    include: couponInclude,
    orderBy: { generatedAt: 'desc' },
  })

  return rows.map(toCouponRow)
}

export async function getCouponForOffer(userId: string, offerId: string): Promise<CouponRow | null> {
  const row = await prisma.coupon.findFirst({
    where: { userId, offerId },
    include: couponInclude,
  })

  return row ? toCouponRow(row) : null
}

export async function getCouponsCountForOffer(offerId: string): Promise<number> {
  return prisma.coupon.count({ where: { offerId } })
}
