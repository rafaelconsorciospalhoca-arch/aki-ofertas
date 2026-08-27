'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { slugify, randomSlugSuffix } from '@/lib/slug'
import { auth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'

const signUpMerchantSchema = z.object({
  ownerName: z.string().min(2, 'Informe seu nome.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  businessName: z.string().min(2, 'Informe o nome da empresa.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  whatsapp: z.string().min(8, 'Informe um WhatsApp válido.'),
  address: z.string().min(3, 'Informe o endereço.'),
  city: z.string().min(2, 'Informe a cidade.'),
  state: z.string().length(2, 'Use a sigla do estado (ex: PR).'),
})

type SignUpMerchantInput = z.infer<typeof signUpMerchantSchema>
type SignUpMerchantResult = { ok: true; businessId: string } | { ok: false; error: string }

export async function signUpMerchant(input: SignUpMerchantInput): Promise<SignUpMerchantResult> {
  const parsed = signUpMerchantSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  const freePlan = await prisma.plan.findUnique({ where: { name: 'Grátis' } })
  if (!freePlan) {
    return { ok: false, error: 'Não foi possível concluir o cadastro. Tente novamente mais tarde.' }
  }

  const state = parsed.data.state.toUpperCase()

  // Small towns are frequently missing street-level data in OpenStreetMap, so an
  // exact address often fails to geocode even though it's real. Falling back to
  // the city center keeps signup working (still enough precision for "near you"
  // sorting) instead of blocking a legitimate business over a map data gap.
  const coordinates =
    (await geocodeAddress(`${parsed.data.address}, ${parsed.data.city} - ${state}, Brasil`)) ??
    (await geocodeAddress(`${parsed.data.city} - ${state}, Brasil`))
  if (!coordinates) {
    return { ok: false, error: 'Não foi possível localizar esse endereço. Confira e tente novamente.' }
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const slug = `${slugify(parsed.data.businessName)}-${randomSlugSuffix()}`
  const primaryCity = await prisma.city.findFirst({ where: { name: parsed.data.city, state } })

  const business = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        name: parsed.data.ownerName,
        email: parsed.data.email,
        passwordHash,
        role: 'MERCHANT',
      },
    })

    return tx.business.create({
      data: {
        ownerId: owner.id,
        name: parsed.data.businessName,
        categoryId: parsed.data.categoryId,
        whatsapp: parsed.data.whatsapp,
        address: parsed.data.address,
        city: parsed.data.city,
        state,
        lat: coordinates.lat,
        lng: coordinates.lng,
        status: 'PENDING',
        planId: freePlan.id,
        slug,
        ...(primaryCity ? { serviceCities: { connect: { id: primaryCity.id } } } : {}),
      },
    })
  })

  return { ok: true, businessId: business.id }
}

const updateBusinessSchema = z.object({
  name: z.string().min(2, 'Informe o nome da empresa.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  description: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  instagram: z.string().optional(),
  website: z.string().optional(),
  address: z.string().min(3, 'Informe o endereço.'),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(2, 'Informe a cidade.'),
  state: z.string().length(2, 'Use a sigla do estado (ex: PR).'),
  zip: z.string().optional(),
  logoUrl: z.string().url('URL inválida.').optional().or(z.literal('')),
  coverUrl: z.string().url('URL inválida.').optional().or(z.literal('')),
  serviceCityIds: z.array(z.string()).optional(),
})

type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>
type UpdateBusinessResult = { ok: true } | { ok: false; error: string }

export async function updateBusiness(input: UpdateBusinessInput): Promise<UpdateBusinessResult> {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'MERCHANT') {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = updateBusinessSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const business = await prisma.business.findFirst({
    where: { ownerId: session.user.id as string },
    include: { owner: { select: { blocked: true } } },
  })
  if (!business || business.owner.blocked) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  const state = parsed.data.state.toUpperCase()
  const primaryCity = await prisma.city.findFirst({ where: { name: parsed.data.city, state } })
  const serviceCityIds = new Set(parsed.data.serviceCityIds ?? [])
  if (primaryCity) {
    serviceCityIds.add(primaryCity.id)
  }

  await prisma.business.update({
    where: { id: business.id },
    data: {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description || null,
      phone: parsed.data.phone || null,
      whatsapp: parsed.data.whatsapp || null,
      email: parsed.data.email || null,
      instagram: parsed.data.instagram || null,
      website: parsed.data.website || null,
      address: parsed.data.address,
      number: parsed.data.number || null,
      neighborhood: parsed.data.neighborhood || null,
      city: parsed.data.city,
      state,
      zip: parsed.data.zip || null,
      logoUrl: parsed.data.logoUrl || null,
      coverUrl: parsed.data.coverUrl || null,
      serviceCities: { set: Array.from(serviceCityIds).map((id) => ({ id })) },
    },
  })

  return { ok: true }
}
