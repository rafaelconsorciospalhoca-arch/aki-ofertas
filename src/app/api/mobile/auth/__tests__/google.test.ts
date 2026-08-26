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
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', role: 'CONSUMER', blocked: false } as never)
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', role: 'CONSUMER', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(200)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a blocked user', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', role: 'CONSUMER', blocked: true } as never)

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Conta bloqueada.' })
  })

  it('normalizes the email Google returns before the lookup and the insert', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: ' Maria@Gmail.com ', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'maria@gmail.com', role: 'CONSUMER', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(200)
    expect(vi.mocked(prisma.user.findUnique).mock.calls[0][0].where.email).toBe('maria@gmail.com')
    expect(vi.mocked(prisma.user.create).mock.calls[0][0].data.email).toBe('maria@gmail.com')
  })

  it('rejects an existing non-consumer account', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', role: 'MERCHANT', blocked: false } as never)

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Esta conta não pode entrar pelo aplicativo.' })
    expect(createMobileSession).not.toHaveBeenCalled()
  })

  it('rejects an existing admin account', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Ana' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Ana', email: 'user@example.com', role: 'ADMIN', blocked: false } as never)

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Esta conta não pode entrar pelo aplicativo.' })
  })

  it('recovers by re-fetching when a concurrent request already created the user', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-1', name: 'Maria', email: 'user@example.com', role: 'CONSUMER', blocked: false } as never)
    vi.mocked(prisma.user.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: ['email'] } }),
    )
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true, token: 'a-token', user: { id: 'user-1', name: 'Maria', email: 'user@example.com' },
    })
  })

  it('returns the JSON contract when an unexpected error escapes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(verifyGoogleIdToken).mockRejectedValue(new Error('network down'))

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ ok: false, error: 'Erro interno. Tente novamente.' })
  })
})
