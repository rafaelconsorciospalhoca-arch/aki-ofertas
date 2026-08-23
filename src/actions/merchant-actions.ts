'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { slugify, randomSlugSuffix } from '@/lib/slug'

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
  lat: z.number({ error: 'Informe a latitude.' }),
  lng: z.number({ error: 'Informe a longitude.' }),
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

  const passwordHash = await hashPassword(parsed.data.password)
  const slug = `${slugify(parsed.data.businessName)}-${randomSlugSuffix()}`

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
        state: parsed.data.state.toUpperCase(),
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        status: 'PENDING',
        planId: freePlan.id,
        slug,
      },
    })
  })

  return { ok: true, businessId: business.id }
}
