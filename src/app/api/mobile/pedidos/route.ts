import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMobileUser } from '@/lib/mobile-session'
import { createOrderForUser, getOrdersForUser } from '@/lib/orders'

export async function GET(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const data = await getOrdersForUser(auth.userId)
  return NextResponse.json({ ok: true, data })
}

const bodySchema = z.object({
  offerId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  phone: z.string().min(8),
  address: z.string().min(3),
  number: z.string().optional(),
  deliveryZoneId: z.string().min(1),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().optional(),
  notes: z.string().optional(),
  selectedChoiceIds: z.array(z.string()).optional(),
})

export async function POST(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const result = await createOrderForUser(auth.userId, parsed.data)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
