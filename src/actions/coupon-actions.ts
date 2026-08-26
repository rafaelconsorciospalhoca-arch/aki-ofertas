'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateCouponForUser, type CouponResult } from '@/lib/coupons'
import { requireMerchantBusiness } from '@/actions/offer-actions'

export async function generateCoupon(offerId: string): Promise<CouponResult> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: 'Não autorizado.' }
  }
  return generateCouponForUser(session.user.id as string, offerId)
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
