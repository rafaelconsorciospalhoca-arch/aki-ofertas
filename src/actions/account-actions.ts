'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { hashPassword, verifyPassword } from '@/lib/password'

type AccountResult = { ok: true } | { ok: false; error: string }

const accountSchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  email: z.string().email('E-mail inválido.'),
})

type AccountInput = z.infer<typeof accountSchema>

export async function updateMerchantAccount(input: AccountInput): Promise<AccountResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = accountSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const conflict = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: business.ownerId } },
  })
  if (conflict) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  await prisma.user.update({
    where: { id: business.ownerId },
    data: { name: parsed.data.name, email: parsed.data.email },
  })

  return { ok: true }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
})

type PasswordInput = z.infer<typeof passwordSchema>

export async function changeMerchantPassword(input: PasswordInput): Promise<AccountResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = passwordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const user = await prisma.user.findUnique({ where: { id: business.ownerId } })
  if (!user?.passwordHash) {
    return { ok: false, error: 'Conta não encontrada.' }
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!valid) {
    return { ok: false, error: 'Senha atual incorreta.' }
  }

  const newHash = await hashPassword(parsed.data.newPassword)
  await prisma.user.update({ where: { id: business.ownerId }, data: { passwordHash: newHash } })

  return { ok: true }
}
