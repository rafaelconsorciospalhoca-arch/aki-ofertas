import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyGoogleIdToken } from '@/lib/google-auth'
import { createMobileSession } from '@/lib/mobile-session'

const bodySchema = z.object({ idToken: z.string().min(1) })

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

    const profile = await verifyGoogleIdToken(parsed.data.idToken)
    if (!profile) {
      return NextResponse.json({ ok: false, error: 'Não foi possível verificar o login do Google.' }, { status: 401 })
    }
    // User.email is a case-sensitive unique column; normalizing here keeps a
    // single account per address across Google, OTP and the site sign-up.
    const email = profile.email.trim().toLowerCase()

    let user = await prisma.user.findUnique({ where: { email } })
    let isNewUser = false
    if (!user) {
      try {
        user = await prisma.user.create({
          data: { email, name: profile.name, role: 'CONSUMER', passwordHash: null },
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

    return NextResponse.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) {
    console.error('POST /api/mobile/auth/google failed', err)
    return NextResponse.json({ ok: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
