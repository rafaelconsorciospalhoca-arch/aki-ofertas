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
  // Users created via Google sign-in have no phone at all. Allow an empty
  // string here (cleared to null below) so editing just the name doesn't
  // force a phone; a non-empty value still has to look like a real phone.
  phone: z.string().min(8, 'Informe um telefone válido.').or(z.literal('')),
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
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const businessCount = await prisma.business.count({ where: { ownerId: auth.userId } })
  if (businessCount > 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Sua conta tem um negócio cadastrado. Escreva para contato@akiofertas.com.br pedindo a exclusão, pra gente cuidar dos pedidos e ofertas vinculados antes.',
      },
      { status: 400 },
    )
  }

  // No cascade delete configured on these relations (by design — an
  // order shouldn't silently vanish just because the FK allows it), so
  // remove the user's own dependent rows first, in one transaction.
  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { userId: auth.userId } }),
    prisma.review.deleteMany({ where: { userId: auth.userId } }),
    prisma.coupon.deleteMany({ where: { userId: auth.userId } }),
    prisma.order.deleteMany({ where: { userId: auth.userId } }),
    prisma.mobileSession.deleteMany({ where: { userId: auth.userId } }),
    prisma.user.delete({ where: { id: auth.userId } }),
  ])

  return NextResponse.json({ ok: true })
}
