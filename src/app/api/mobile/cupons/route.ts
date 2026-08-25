import { NextResponse } from 'next/server'
import { requireMobileUser } from '@/lib/mobile-session'
import { getCouponsForUser } from '@/lib/coupons'

export async function GET(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const data = await getCouponsForUser(auth.userId)
  return NextResponse.json({ ok: true, data })
}
