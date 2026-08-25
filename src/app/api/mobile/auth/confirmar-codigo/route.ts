import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyOtpCode, MAX_OTP_ATTEMPTS } from '@/lib/mobile-auth'
import { createMobileSession } from '@/lib/mobile-session'

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
  name: z.string().min(2).optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }
  const { email, code, name } = parsed.data

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
  if (!user) {
    if (!name) {
      return NextResponse.json({ ok: false, error: 'Informe seu nome.' }, { status: 400 })
    }
    user = await prisma.user.create({
      data: { email, name, role: 'CONSUMER', passwordHash: null },
    })
  }
  if (user.blocked) {
    return NextResponse.json({ ok: false, error: 'Conta bloqueada.' }, { status: 401 })
  }

  const token = await createMobileSession(user.id)

  return NextResponse.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } })
}
