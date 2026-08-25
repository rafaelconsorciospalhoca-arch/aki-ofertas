import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/google/route'
import { prisma } from '@/lib/db'
import { verifyGoogleIdToken } from '@/lib/google-auth'
import { createMobileSession } from '@/lib/mobile-session'

vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/google-auth', () => ({ verifyGoogleIdToken: vi.fn() }))
vi.mock('@/lib/mobile-session', () => ({ createMobileSession: vi.fn() }))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/google', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/mobile/auth/google', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid body', async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
  })

  it('rejects when the Google token cannot be verified', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(null)
    const response = await POST(request({ idToken: 'bad-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Não foi possível verificar o login do Google.' })
  })

  it('creates a new user from the Google profile', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true, token: 'a-token', user: { id: 'user-1', name: 'Maria', email: 'user@example.com' },
    })
    const data = vi.mocked(prisma.user.create).mock.calls[0][0].data
    expect(data.role).toBe('CONSUMER')
    expect(data.passwordHash).toBeNull()
  })

  it('logs in an existing user', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(200)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a blocked user', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: true } as never)

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Conta bloqueada.' })
  })
})
