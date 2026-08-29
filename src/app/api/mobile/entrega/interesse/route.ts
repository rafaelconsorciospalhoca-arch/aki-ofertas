import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'
import { sendDeliveryZoneRequestEmail } from '@/lib/email'

const bodySchema = z.object({
  businessId: z.string().min(1),
  neighborhood: z.string().trim().min(2).max(60),
})

export async function POST(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { id: parsed.data.businessId },
    select: { name: true, email: true, owner: { select: { email: true } } },
  })
  if (!business) {
    return NextResponse.json({ ok: false, error: 'Estabelecimento não encontrado.' }, { status: 404 })
  }

  const notifyEmail = business.email || business.owner.email
  if (notifyEmail) {
    sendDeliveryZoneRequestEmail(notifyEmail, {
      businessName: business.name,
      neighborhood: parsed.data.neighborhood,
    }).catch((err) => console.error('Failed to send delivery zone request email', err))
  }

  return NextResponse.json({ ok: true })
}
