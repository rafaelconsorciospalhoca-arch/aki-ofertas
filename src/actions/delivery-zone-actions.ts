'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { reaisToCents } from '@/lib/money'
import { PaymentMethod } from '@prisma/client'

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

const importRowSchema = z.object({
  neighborhood: z.string().trim().min(1),
  feeCents: z.string().trim().min(1),
})

type ImportResult = { ok: true; imported: number; errors: string[] } | { ok: false; error: string }

export async function importDeliveryZones(rows: { neighborhood: string; feeCents: string }[]): Promise<ImportResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: 'Nenhum bairro encontrado no arquivo.' }
  }
  if (rows.length > 500) {
    return { ok: false, error: 'Máximo de 500 bairros por importação.' }
  }

  let imported = 0
  const errors: string[] = []

  for (const row of rows) {
    const parsed = importRowSchema.safeParse(row)
    if (!parsed.success) {
      errors.push(`Linha inválida: "${row?.neighborhood?.trim() ?? ''}".`)
      continue
    }

    const neighborhood = parsed.data.neighborhood
    // Accept comma-decimal ("5,90") since that's how most Brazilian
    // spreadsheets format currency, alongside the dot format the form uses.
    const feeCents = reaisToCents(parsed.data.feeCents.replace(',', '.'))
    if (feeCents === null || feeCents < 0) {
      errors.push(`Taxa inválida para "${neighborhood}".`)
      continue
    }

    await prisma.deliveryZone.upsert({
      where: { businessId_neighborhood: { businessId: business.id, neighborhood } },
      update: { feeCents, active: true },
      create: { businessId: business.id, neighborhood, feeCents },
    })
    imported++
  }

  return { ok: true, imported, errors }
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

const paymentMethodsSchema = z.array(z.nativeEnum(PaymentMethod))

export async function updateAcceptedPaymentMethods(
  methods: PaymentMethod[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = paymentMethodsSchema.safeParse(methods)
  if (!parsed.success) {
    return { ok: false, error: 'Forma de pagamento inválida.' }
  }

  await prisma.business.update({
    where: { id: business.id },
    data: { acceptedPaymentMethods: { set: parsed.data } },
  })

  return { ok: true }
}
