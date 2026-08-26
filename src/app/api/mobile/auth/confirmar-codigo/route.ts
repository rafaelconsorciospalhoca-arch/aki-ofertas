import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyOtpCode, MAX_OTP_ATTEMPTS } from '@/lib/mobile-auth'
import { createMobileSession } from '@/lib/mobile-session'

const bodySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().min(6).max(6),
  name: z.string().min(2).optional(),
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
    const { code, name } = parsed.data
    // User.email is a case-sensitive unique column; normalizing here keeps a
    // single account per address across OTP, Google and the site sign-up.
    const email = parsed.data.email.trim().toLowerCase()

    const otp = await prisma.emailOtp.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp) {
      return NextResponse.json({ ok: false, error: 'Código inválido.' }, { status: 400 })
    }
    if (otp.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, error: 'Código expirado.' }, { status: 400 })
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ ok: false, error: 'Código inválido.' }, { status: 400 })
    }

    const valid = await verifyOtpCode(code, otp.codeHash)
    if (!valid) {
      await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
      return NextResponse.json({ ok: false, error: 'Código inválido.' }, { status: 400 })
    }

    await prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } })

    let user = await prisma.user.findUnique({ where: { email } })
    let isNewUser = false
    if (!user) {
      if (!name) {
        return NextResponse.json({ ok: false, error: 'Informe seu nome.' }, { status: 400 })
      }
      try {
        user = await prisma.user.create({
          data: { email, name, role: 'CONSUMER', passwordHash: null },
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
    console.error('POST /api/mobile/auth/confirmar-codigo failed', err)
    return NextResponse.json({ ok: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
