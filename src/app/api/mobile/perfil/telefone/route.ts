import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'

const bodySchema = z.object({ phone: z.string().min(8) })

export async function POST(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Informe um telefone válido.' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: auth.userId }, data: { phone: parsed.data.phone } })

  return NextResponse.json({ ok: true })
}
