'use server'

import { z } from 'zod'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { updateOrderStatusForBusiness } from '@/lib/orders'

const statusSchema = z.enum(['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])

export async function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = statusSchema.safeParse(status)
  if (!parsed.success) {
    return { ok: false, error: 'Status inválido.' }
  }

  return updateOrderStatusForBusiness(business.id, orderId, parsed.data)
}
