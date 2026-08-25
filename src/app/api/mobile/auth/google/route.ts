import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyGoogleIdToken } from '@/lib/google-auth'
import { createMobileSession } from '@/lib/mobile-session'

const bodySchema = z.object({ idToken: z.string().min(1) })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const profile = await verifyGoogleIdToken(parsed.data.idToken)
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Não foi possível verificar o login do Google.' }, { status: 401 })
  }

  let user = await prisma.user.findUnique({ where: { email: profile.email } })
  if (!user) {
    user = await prisma.user.create({
      data: { email: profile.email, name: profile.name, role: 'CONSUMER', passwordHash: null },
    })
  }
  if (user.blocked) {
    return NextResponse.json({ ok: false, error: 'Conta bloqueada.' }, { status: 401 })
  }

  const token = await createMobileSession(user.id)

  return NextResponse.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } })
}
