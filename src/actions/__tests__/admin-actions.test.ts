import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateBusinessStatus } from '@/actions/admin-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    city: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

describe('updateBusinessStatus', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid status value', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    // @ts-expect-error deliberately invalid for the test
    const result = await updateBusinessStatus('biz-1', 'NOT_A_STATUS')
    expect(result).toEqual({ ok: false, error: 'Status inválido.' })
  })

  it('rejects when the business does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('updates the business status when the admin and business are valid', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'ACTIVE' },
    })
  })
})
