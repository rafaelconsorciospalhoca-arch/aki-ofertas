import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'

export async function GET(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, city: true, phone: true },
  })

  return NextResponse.json({ ok: true, data: user })
}

const putBodySchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  phone: z.string().min(8, 'Informe um telefone válido.'),
})

export async function PUT(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = putBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: { name: parsed.data.name, phone: parsed.data.phone },
  })

  return NextResponse.json({ ok: true })
}
