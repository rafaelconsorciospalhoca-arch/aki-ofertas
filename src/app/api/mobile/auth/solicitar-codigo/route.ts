import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendOtpEmail } from '@/lib/email'
import { generateOtpCode, hashOtpCode, addMinutes, OTP_EXPIRY_MINUTES } from '@/lib/mobile-auth'

const RATE_LIMIT_SECONDS = 60
const MAX_PER_DAY = 5

const bodySchema = z.object({ email: z.string().email() })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'E-mail inválido.' }, { status: 400 })
  }
  const email = parsed.data.email

  const recent = await prisma.emailOtp.findFirst({
    where: { email, createdAt: { gt: new Date(Date.now() - RATE_LIMIT_SECONDS * 1000) } },
    orderBy: { createdAt: 'desc' },
  })
  if (recent) {
    return NextResponse.json({ ok: false, error: 'Aguarde antes de pedir um novo código.' }, { status: 429 })
  }

  const countToday = await prisma.emailOtp.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  if (countToday >= MAX_PER_DAY) {
    return NextResponse.json({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 })
  }

  const code = generateOtpCode()
  const codeHash = await hashOtpCode(code)
  await prisma.emailOtp.create({
    data: { email, codeHash, expiresAt: addMinutes(new Date(), OTP_EXPIRY_MINUTES) },
  })

  await sendOtpEmail(email, code)

  return NextResponse.json({ ok: true })
}
