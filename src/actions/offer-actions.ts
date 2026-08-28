'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { slugify, randomSlugSuffix } from '@/lib/slug'
import { parseOfferInput, type OfferFormInput } from '@/lib/offer-pricing'

const offerSchema = z.object({
  title: z.string().min(3, 'Informe um título.'),
  description: z.string().optional(),
  imageUrl: z.string().url('URL inválida.').optional().or(z.literal('')),
  originalPrice: z.string().min(1, 'Informe o preço original.'),
  discountPrice: z.string().min(1, 'Informe o preço promocional.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  quantityAvailable: z.string().optional(),
  startDate: z.string().min(1, 'Informe a data inicial.'),
  endDate: z.string().min(1, 'Informe a data final.'),
  deliveryEnabled: z.boolean().optional(),
  customCouponCode: z.string().optional(),
})

type OfferActionInput = OfferFormInput & z.infer<typeof offerSchema>
type OfferResult = { ok: true; offerId: string } | { ok: false; error: string }

export async function requireMerchantBusiness() {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'MERCHANT') {
    return null
  }

  const business = await prisma.business.findFirst({
    where: { ownerId: session.user.id as string },
    include: { owner: { select: { blocked: true } }, plan: true },
  })
  if (!business || business.owner.blocked || business.status === 'SUSPENDED') {
    return null
  }

  return business
}

export async function createOffer(input: OfferActionInput): Promise<OfferResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = offerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const computed = parseOfferInput(parsed.data)
  if ('error' in computed) {
    return { ok: false, error: computed.error }
  }

  if (business.plan) {
    const activeCount = await prisma.offer.count({ where: { businessId: business.id, status: 'ACTIVE' } })
    if (activeCount >= business.plan.maxOffersPerMonth) {
      return {
        ok: false,
        error: `Você atingiu o limite de ${business.plan.maxOffersPerMonth} ofertas ativas do seu plano. Desative uma oferta ou assine um plano maior pra criar mais.`,
      }
    }
  }

  const slug = `${slugify(parsed.data.title)}-${randomSlugSuffix()}`

  const offer = await prisma.offer.create({
    data: {
      businessId: business.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
      originalPrice: computed.originalPrice,
      discountPrice: computed.discountPrice,
      discountPercent: computed.discountPercent,
      categoryId: parsed.data.categoryId,
      quantityAvailable: computed.quantityAvailable,
      startDate: computed.startDate,
      endDate: computed.endDate,
      deliveryEnabled: parsed.data.deliveryEnabled ?? false,
      customCouponCode: parsed.data.customCouponCode || null,
      status: 'ACTIVE',
      slug,
    },
  })

  return { ok: true, offerId: offer.id }
}

export async function updateOffer(offerId: string, input: OfferActionInput): Promise<OfferResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.offer.findFirst({ where: { id: offerId, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Oferta não encontrada.' }
  }

  const parsed = offerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const computed = parseOfferInput(parsed.data)
  if ('error' in computed) {
    return { ok: false, error: computed.error }
  }

  await prisma.offer.update({
    where: { id: offerId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
      originalPrice: computed.originalPrice,
      discountPrice: computed.discountPrice,
      discountPercent: computed.discountPercent,
      categoryId: parsed.data.categoryId,
      quantityAvailable: computed.quantityAvailable,
      startDate: computed.startDate,
      endDate: computed.endDate,
      deliveryEnabled: parsed.data.deliveryEnabled ?? false,
      customCouponCode: parsed.data.customCouponCode || null,
    },
  })

  return { ok: true, offerId }
}

export async function cancelOffer(offerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.offer.findFirst({ where: { id: offerId, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Oferta não encontrada.' }
  }

  await prisma.offer.update({ where: { id: offerId }, data: { status: 'CANCELLED' } })

  return { ok: true }
}
