'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateCouponCode } from '@/lib/coupon-code'
import { requireMerchantBusiness } from '@/actions/offer-actions'

type CouponSummary = { id: string; code: string; expiresAt: Date }
type CouponResult = { ok: true; coupon: CouponSummary } | { ok: false; error: string }

export async function generateCoupon(offerId: string): Promise<CouponResult> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: 'Não autorizado.' }
  }
  const userId = session.user.id as string

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.coupon.findFirst({ where: { userId, offerId } })
    if (existing) {
      return { ok: true as const, coupon: existing }
    }

    const offer = await tx.offer.findUnique({ where: { id: offerId } })
    if (!offer || offer.status !== 'ACTIVE') {
      return { ok: false as const, error: 'Oferta não encontrada.' }
    }

    if (offer.quantityAvailable !== null) {
      const count = await tx.coupon.count({ where: { offerId } })
      if (count >= offer.quantityAvailable) {
        return { ok: false as const, error: 'Esta oferta esgotou.' }
      }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
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
      } catch (err) {
        const isUniqueViolation = (err as { code?: string }).code === 'P2002'
        if (!isUniqueViolation || attempt === 2) throw err
      }
    }
    throw new Error('unreachable')
  })

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    coupon: { id: result.coupon.id, code: result.coupon.code, expiresAt: result.coupon.expiresAt },
  }
}
