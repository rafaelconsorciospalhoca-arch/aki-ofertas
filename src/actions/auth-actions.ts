'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

const signUpSchema = z.object({
  name: z.string().min(2, 'Informe seu nome.'),
  email: z.string().email('E-mail inválido.'),
  phone: z.string().optional(),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  city: z.string().optional(),
  state: z.string().optional(),
})

type SignUpInput = z.infer<typeof signUpSchema>
type SignUpResult = { ok: true; userId: string } | { ok: false; error: string }

export async function signUpConsumer(input: SignUpInput): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  const passwordHash = await hashPassword(parsed.data.password)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash,
      role: 'CONSUMER',
      city: parsed.data.city,
      state: parsed.data.state,
    },
  })

  return { ok: true, userId: user.id }
}
