'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateCouponCode } from '@/lib/coupon-code'
import { requireMerchantBusiness } from '@/actions/offer-actions'

type CouponSummary = { id: string; code: string; expiresAt: Date }
type CouponResult = { ok: true; coupon: CouponSummary } | { ok: false; error: string }

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

export async function generateCoupon(offerId: string): Promise<CouponResult> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: 'Não autorizado.' }
  }
  return generateCouponForUser(session.user.id as string, offerId)
}

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

type ValidateCouponResult =
  | { ok: true; offerTitle: string; customerName: string }
  | { ok: false; error: string }

export async function validateCoupon(code: string): Promise<ValidateCouponResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: { offer: { select: { title: true } }, user: { select: { name: true } } },
  })
  if (!coupon) {
    return { ok: false, error: 'Cupom não encontrado.' }
  }

  if (coupon.businessId !== business.id) {
    return { ok: false, error: 'Este cupom não é de uma oferta da sua loja.' }
  }

  if (coupon.status === 'USED') {
    return { ok: false, error: 'Este cupom já foi utilizado.' }
  }

  if (coupon.expiresAt < new Date()) {
    return { ok: false, error: 'Este cupom está expirado.' }
  }

  await prisma.coupon.update({ where: { id: coupon.id }, data: { status: 'USED', usedAt: new Date() } })

  return { ok: true, offerTitle: coupon.offer.title, customerName: coupon.user.name.split(' ')[0] }
}
