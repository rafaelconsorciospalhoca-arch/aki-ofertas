import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMobileSession, getUserFromToken, requireMobileUser } from '@/lib/mobile-session'
import { prisma } from '@/lib/db'
import { hashSessionToken } from '@/lib/mobile-auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    mobileSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))

describe('createMobileSession', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a session and returns the raw token', async () => {
    vi.mocked(prisma.mobileSession.create).mockResolvedValue({} as never)

    const token = await createMobileSession('user-1')

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const data = vi.mocked(prisma.mobileSession.create).mock.calls[0][0].data
    expect(data.userId).toBe('user-1')
    expect(data.tokenHash).toBe(hashSessionToken(token))
    expect(data.tokenHash).not.toBe(token)
  })
})

describe('getUserFromToken', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no session matches', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue(null)
    const result = await getUserFromToken('any-token')
    expect(result).toBeNull()
  })

  it('returns null when the session was revoked', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: false },
    } as never)
    const result = await getUserFromToken('any-token')
    expect(result).toBeNull()
  })

  it('returns null when the session expired', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() - 1000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: false },
    } as never)
    const result = await getUserFromToken('any-token')
    expect(result).toBeNull()
  })

  it('returns null and revokes the session when the user is blocked', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: true },
    } as never)
    vi.mocked(prisma.mobileSession.update).mockResolvedValue({} as never)

    const result = await getUserFromToken('any-token')

    expect(result).toBeNull()
    expect(prisma.mobileSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sess-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    )
  })

  it('returns the user when the session is valid', async () => {
    const user = { id: 'user-1', role: 'CONSUMER', blocked: false }
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() + 100000), user,
    } as never)

    const result = await getUserFromToken('any-token')
    expect(result).toEqual(user)
  })
})

describe('requireMobileUser', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a 401 response when there is no Authorization header', async () => {
    const request = new Request('https://example.com', { headers: {} })
    const result = await requireMobileUser(request)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns a 401 response when the token does not match a valid session', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue(null)
    const request = new Request('https://example.com', { headers: { authorization: 'Bearer bad-token' } })
    const result = await requireMobileUser(request)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns the userId when the token is valid', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: false },
    } as never)
    const request = new Request('https://example.com', { headers: { authorization: 'Bearer good-token' } })
    const result = await requireMobileUser(request)
    expect(result).toEqual({ userId: 'user-1' })
  })
})
