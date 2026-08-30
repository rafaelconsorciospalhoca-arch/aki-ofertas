'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { reaisToCents } from '@/lib/money'

const groupSchema = z.object({
  offerId: z.string().min(1),
  name: z.string().min(2, 'Informe o nome do grupo.'),
  type: z.enum(['SINGLE', 'MULTIPLE']),
  required: z.boolean(),
})

type GroupInput = z.infer<typeof groupSchema>
type GroupResult = { ok: true; groupId: string } | { ok: false; error: string }

export async function createOptionGroup(input: GroupInput): Promise<GroupResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const offer = await prisma.offer.findFirst({ where: { id: parsed.data.offerId, businessId: business.id } })
  if (!offer) {
    return { ok: false, error: 'Oferta não encontrada.' }
  }

  const group = await prisma.offerOptionGroup.create({
    data: {
      offerId: offer.id,
      name: parsed.data.name,
      type: parsed.data.type,
      required: parsed.data.required,
    },
  })

  return { ok: true, groupId: group.id }
}

export async function deleteOptionGroup(groupId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const group = await prisma.offerOptionGroup.findFirst({
    where: { id: groupId, offer: { businessId: business.id } },
  })
  if (!group) {
    return { ok: false, error: 'Grupo não encontrado.' }
  }

  await prisma.offerOptionGroup.delete({ where: { id: groupId } })
  return { ok: true }
}

const choiceSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1, 'Informe o nome da opção.'),
  extraPriceCents: z.string().optional(),
})

type ChoiceInput = z.infer<typeof choiceSchema>
type ChoiceResult = { ok: true; choiceId: string } | { ok: false; error: string }

export async function createOptionChoice(input: ChoiceInput): Promise<ChoiceResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = choiceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const group = await prisma.offerOptionGroup.findFirst({
    where: { id: parsed.data.groupId, offer: { businessId: business.id } },
  })
  if (!group) {
    return { ok: false, error: 'Grupo não encontrado.' }
  }

  let extraPriceCents = 0
  if (parsed.data.extraPriceCents && parsed.data.extraPriceCents.trim()) {
    const parsedPrice = reaisToCents(parsed.data.extraPriceCents)
    if (parsedPrice === null || parsedPrice < 0) {
      return { ok: false, error: 'Informe um preço extra válido.' }
    }
    extraPriceCents = parsedPrice
  }

  const choice = await prisma.offerOptionChoice.create({
    data: { groupId: group.id, name: parsed.data.name, extraPriceCents },
  })

  return { ok: true, choiceId: choice.id }
}

export async function deleteOptionChoice(choiceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const choice = await prisma.offerOptionChoice.findFirst({
    where: { id: choiceId, group: { offer: { businessId: business.id } } },
  })
  if (!choice) {
    return { ok: false, error: 'Opção não encontrada.' }
  }

  await prisma.offerOptionChoice.delete({ where: { id: choiceId } })
  return { ok: true }
}
