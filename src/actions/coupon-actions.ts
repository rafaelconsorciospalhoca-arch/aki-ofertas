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
