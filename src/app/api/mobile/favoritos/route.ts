import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMobileUser } from '@/lib/mobile-session'
import { getFavoritesForUser, toggleFavorite } from '@/lib/favorites'

export async function GET(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const data = await getFavoritesForUser(auth.userId)
  return NextResponse.json({ ok: true, data })
}

const bodySchema = z
  .object({ offerId: z.string().min(1).optional(), businessId: z.string().min(1).optional() })
  .refine((v) => (v.offerId ? !v.businessId : !!v.businessId), {
    message: 'Informe offerId ou businessId.',
  })

export async function POST(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const target = parsed.data.offerId
    ? ({ offerId: parsed.data.offerId } as const)
    : ({ businessId: parsed.data.businessId! } as const)

  const result = await toggleFavorite(auth.userId, target)
  return NextResponse.json({ ok: true, data: result })
}
