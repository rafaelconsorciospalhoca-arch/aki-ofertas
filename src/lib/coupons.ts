import { prisma } from '@/lib/db'
import { generateCouponCode } from '@/lib/coupon-code'
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

export type CouponSummary = { id: string; code: string; expiresAt: Date }
export type CouponResult = { ok: true; coupon: CouponSummary } | { ok: false; error: string }

const OFFER_NOT_AVAILABLE = 'Oferta não encontrada.'
const SOLD_OUT = 'Esta oferta esgotou.'
const GENERATE_FAILED = 'Não foi possível gerar o cupom. Tente novamente.'
const MAX_ATTEMPTS = 3

function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | null | undefined)?.code
}

/** Lowercased, comma-joined `meta.target` of a Prisma P2002 unique-constraint error. */
function uniqueTarget(err: unknown): string {
  const target = (err as { meta?: { target?: unknown } } | null | undefined)?.meta?.target
  if (Array.isArray(target)) return target.map(String).join(',').toLowerCase()
  if (typeof target === 'string') return target.toLowerCase()
  return ''
}

/** True when the violated unique constraint is the `(userId, offerId)` one. */
function isUserOfferConflict(err: unknown): boolean {
  const target = uniqueTarget(err)
  return target.includes('userid') && target.includes('offerid')
}

function toSummary(coupon: { id: string; code: string; expiresAt: Date }): CouponSummary {
  return { id: coupon.id, code: coupon.code, expiresAt: coupon.expiresAt }
}

/**
 * Generates (or returns the existing) coupon for `userId` on `offerId`.
 *
 * This lives in a plain module rather than a `'use server'` file on purpose: it
 * takes `userId` as an argument and performs NO authorization of its own, so
 * exporting it from a Server Actions file would expose it as a public HTTP
 * endpoint callable with an arbitrary userId. Every caller must resolve and
 * authorize `userId` itself first.
 */
export async function generateCouponForUser(userId: string, offerId: string): Promise<CouponResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      // Serializable so that Postgres itself rejects concurrent transactions whose
      // stock count would be invalidated by a competing insert (surfaced as P2034).
      const result = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.coupon.findFirst({ where: { userId, offerId } })
          if (existing) {
            return { ok: true as const, coupon: existing }
          }

          const offer = await tx.offer.findUnique({
            where: { id: offerId },
            include: {
              business: { select: { status: true, owner: { select: { blocked: true } } } },
            },
          })

          // Mirrors the public visibility rules in getOfferBySlug. A single opaque
          // message for every failure, so we don't leak which condition failed.
          if (!offer || offer.status !== 'ACTIVE') {
            return { ok: false as const, error: OFFER_NOT_AVAILABLE }
          }
          if (offer.business.status !== 'ACTIVE' || offer.business.owner.blocked) {
            return { ok: false as const, error: OFFER_NOT_AVAILABLE }
          }
          const now = new Date()
          if (offer.startDate > now || offer.endDate < now) {
            return { ok: false as const, error: OFFER_NOT_AVAILABLE }
          }

          if (offer.quantityAvailable !== null) {
            const count = await tx.coupon.count({ where: { offerId } })
            if (count >= offer.quantityAvailable) {
              return { ok: false as const, error: SOLD_OUT }
            }
          }

          const coupon = await tx.coupon.create({
            data: {
              userId,
              offerId,
              businessId: offer.businessId,
              code: generateCouponCode(),
              status: 'GENERATED',
              expiresAt: offer.endDate,
            },
          })
          return { ok: true as const, coupon }
        },
        { isolationLevel: 'Serializable' },
      )

      if (!result.ok) {
        return result
      }
      return { ok: true, coupon: toSummary(result.coupon) }
    } catch (err) {
      const code = errorCode(err)

      // A concurrent request for the same user+offer won the race. The whole
      // transaction is aborted, so re-read outside of it and return that coupon:
      // one coupon per person per offer makes this idempotent, not an error.
      if (code === 'P2002' && isUserOfferConflict(err)) {
        const winner = await prisma.coupon.findFirst({ where: { userId, offerId } })
        if (winner) {
          return { ok: true, coupon: toSummary(winner) }
        }
        continue
      }

      // P2034: serialization conflict. P2002 on `code`: astronomically unlikely
      // collision. Both are retried by re-running the whole transaction — a
      // retry *inside* the aborted transaction would only fail with 25P02.
      if (code === 'P2034' || code === 'P2002') {
        continue
      }

      console.error('generateCoupon failed', err)
      return { ok: false, error: GENERATE_FAILED }
    }
  }

  return { ok: false, error: GENERATE_FAILED }
}
