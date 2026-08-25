import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateSessionToken, hashSessionToken, addDays, MOBILE_SESSION_DAYS } from '@/lib/mobile-auth'

export type MobileUser = { id: string; role: string; blocked: boolean }

export async function createMobileSession(userId: string): Promise<string> {
  const token = generateSessionToken()
  const tokenHash = hashSessionToken(token)

  await prisma.mobileSession.create({
    data: { userId, tokenHash, expiresAt: addDays(new Date(), MOBILE_SESSION_DAYS) },
  })

  return token
}

export async function getUserFromToken(token: string): Promise<MobileUser | null> {
  const tokenHash = hashSessionToken(token)

  const session = await prisma.mobileSession.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true, blocked: true } } },
  })
  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null

  if (session.user.blocked) {
    await prisma.mobileSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
    return null
  }

  return session.user
}

export async function requireMobileUser(request: Request): Promise<{ userId: string } | NextResponse> {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
  }

  const user = await getUserFromToken(token)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
  }

  return { userId: user.id }
}
