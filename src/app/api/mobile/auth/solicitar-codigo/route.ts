import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendOtpEmail } from '@/lib/email'
import { generateOtpCode, hashOtpCode, addMinutes, OTP_EXPIRY_MINUTES } from '@/lib/mobile-auth'

const RATE_LIMIT_SECONDS = 60
const MAX_PER_DAY = 5

const bodySchema = z.object({ email: z.string().trim().email() })

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'E-mail inválido.' }, { status: 400 })
    }
    // Normalized before any read or write so rate limiting, storage and the later
    // lookup in confirmar-codigo all key off the same form of the address.
    const email = parsed.data.email.trim().toLowerCase()

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

    try {
      await sendOtpEmail(email, code)
    } catch (err) {
      // The OTP row stays behind (a burned quota slot) rather than adding rollback
      // complexity; what matters is that the caller gets this API's JSON contract.
      console.error('sendOtpEmail failed', err)
      return NextResponse.json(
        { ok: false, error: 'Não foi possível enviar o código. Tente novamente.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/mobile/auth/solicitar-codigo failed', err)
    return NextResponse.json({ ok: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
