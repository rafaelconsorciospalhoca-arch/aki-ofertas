import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'

export async function GET(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, city: true },
  })

  return NextResponse.json({ ok: true, data: user })
}
