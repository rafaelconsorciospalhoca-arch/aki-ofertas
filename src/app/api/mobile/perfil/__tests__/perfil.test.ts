import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { DELETE } from '@/app/api/mobile/perfil/route'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { count: vi.fn() },
    favorite: { deleteMany: vi.fn() },
    review: { deleteMany: vi.fn() },
    coupon: { deleteMany: vi.fn() },
    order: { deleteMany: vi.fn() },
    mobileSession: { deleteMany: vi.fn() },
    user: { delete: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}))
vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))

function request() {
  return new Request('https://example.com/api/mobile/perfil', { method: 'DELETE' })
}

describe('DELETE /api/mobile/perfil', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await DELETE(request())
    expect(response.status).toBe(401)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete an account that owns a business', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.count).mockResolvedValue(1)

    const response = await DELETE(request())

    expect(response.status).toBe(400)
    expect(prisma.user.delete).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('deletes the user and their dependent rows', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.count).mockResolvedValue(0)

    const response = await DELETE(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.coupon.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.order.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.mobileSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })
})
