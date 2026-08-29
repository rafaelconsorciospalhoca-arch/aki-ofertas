'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { reaisToCents } from '@/lib/money'

const zoneSchema = z.object({
  id: z.string().optional(),
  neighborhood: z.string().trim().min(2, 'Informe o nome do bairro.'),
  feeCents: z.string().min(1, 'Informe o valor da taxa.'),
})

type ZoneInput = z.infer<typeof zoneSchema>
type ZoneResult = { ok: true; zoneId: string } | { ok: false; error: string }

export async function upsertDeliveryZone(input: ZoneInput): Promise<ZoneResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = zoneSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const feeCents = reaisToCents(parsed.data.feeCents)
  if (feeCents === null || feeCents < 0) {
    return { ok: false, error: 'Informe um valor de taxa válido.' }
  }

  const neighborhood = parsed.data.neighborhood

  if (parsed.data.id) {
    const existing = await prisma.deliveryZone.findFirst({
      where: { id: parsed.data.id, businessId: business.id },
    })
    if (!existing) {
      return { ok: false, error: 'Bairro não encontrado.' }
    }
    const updated = await prisma.deliveryZone.update({
      where: { id: existing.id },
      data: { neighborhood, feeCents },
    })
    return { ok: true, zoneId: updated.id }
  }

  const zone = await prisma.deliveryZone.upsert({
    where: { businessId_neighborhood: { businessId: business.id, neighborhood } },
    update: { feeCents, active: true },
    create: { businessId: business.id, neighborhood, feeCents },
  })

  return { ok: true, zoneId: zone.id }
}

export async function deleteDeliveryZone(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.deliveryZone.findFirst({ where: { id, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Bairro não encontrado.' }
  }

  await prisma.deliveryZone.delete({ where: { id } })
  return { ok: true }
}

export async function toggleDeliveryZoneActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.deliveryZone.findFirst({ where: { id, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Bairro não encontrado.' }
  }

  await prisma.deliveryZone.update({ where: { id }, data: { active } })
  return { ok: true }
}
