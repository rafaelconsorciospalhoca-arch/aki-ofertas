import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMobileUser } from '@/lib/mobile-session'
import { generateCouponForUser } from '@/lib/coupons'

const bodySchema = z.object({ offerId: z.string().min(1) })

export async function POST(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const result = await generateCouponForUser(auth.userId, parsed.data.offerId)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
