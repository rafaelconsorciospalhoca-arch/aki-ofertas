'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { signOut } from '@/lib/auth'

export async function signOutUser(): Promise<void> {
  await signOut({ redirectTo: '/entrar' })
}

const signUpSchema = z.object({
  name: z.string().min(2, 'Informe seu nome.'),
  email: z.string().trim().email('E-mail inválido.'),
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

  // User.email is a case-sensitive unique column; normalizing keeps a single
  // account per address across this form and the passwordless mobile flows.
  const email = parsed.data.email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  const passwordHash = await hashPassword(parsed.data.password)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      passwordHash,
      role: 'CONSUMER',
      city: parsed.data.city,
      state: parsed.data.state,
    },
  })

  return { ok: true, userId: user.id }
}
