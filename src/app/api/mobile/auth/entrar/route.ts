import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createMobileSession } from '@/lib/mobile-session'
import { sendSignupConfirmationEmail } from '@/lib/email'

const bodySchema = z.object({
  email: z.string().trim().email(),
  name: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  state: z.string().length(2).optional(),
  phone: z.string().min(8).optional(),
})

function isUniqueConstraintError(err: unknown): boolean {
  return (err as { code?: string } | null | undefined)?.code === 'P2002'
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
    }
    const { name, city, state, phone } = parsed.data
    // User.email is a case-sensitive unique column; normalizing here keeps a
    // single account per address across email, Google and the site sign-up.
    const email = parsed.data.email.trim().toLowerCase()

    let user = await prisma.user.findUnique({ where: { email } })
    let isNewUser = false
    if (!user) {
      // Marketing needs city/state/phone on every email signup (Google signups
      // skip this — they enter directly with just name/email, and are asked
      // for a phone number later, at coupon redemption).
      if (!name || !city || !state || !phone) {
        return NextResponse.json({ ok: false, error: 'Informe seus dados para continuar.' }, { status: 400 })
      }
      try {
        user = await prisma.user.create({
          data: { email, name, city, state: state.toUpperCase(), phone, role: 'CONSUMER', passwordHash: null },
        })
        isNewUser = true
      } catch (err) {
        // A concurrent first login for the same address won the race on the
        // `email` unique constraint; adopt that row and continue as a login.
        if (!isUniqueConstraintError(err)) throw err
        user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          return NextResponse.json({ ok: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
        }
      }
    }
    if (user.blocked) {
      return NextResponse.json({ ok: false, error: 'Conta bloqueada.' }, { status: 401 })
    }
    // The app is consumer-only: a merchant/admin must not get a 60-day bearer
    // token without their password. Newly created users are always CONSUMER.
    if (!isNewUser && user.role !== 'CONSUMER') {
      return NextResponse.json(
        { ok: false, error: 'Esta conta não pode entrar pelo aplicativo.' },
        { status: 401 },
      )
    }

    const token = await createMobileSession(user.id)

    if (isNewUser) {
      // Best-effort: the account is already created and usable, so a failed
      // confirmation email must not block or fail the response.
      sendSignupConfirmationEmail(user.email, user.name).catch((err) => {
        console.error('sendSignupConfirmationEmail failed', err)
      })
    }

    return NextResponse.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) {
    console.error('POST /api/mobile/auth/entrar failed', err)
    return NextResponse.json({ ok: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
