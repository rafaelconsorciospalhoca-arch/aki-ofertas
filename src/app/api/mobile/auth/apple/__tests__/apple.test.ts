import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/apple/route'
import { prisma } from '@/lib/db'
import { verifyAppleIdentityToken } from '@/lib/apple-auth'
import { createMobileSession } from '@/lib/mobile-session'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/apple-auth', () => ({
  verifyAppleIdentityToken: vi.fn(),
}))

vi.mock('@/lib/mobile-session', () => ({
  createMobileSession: vi.fn(),
}))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/apple', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/mobile/auth/apple', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a missing idToken', async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Dados inválidos.' })
  })

  it('rejects when the identity token fails verification', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue(null)
    const response = await POST(request({ idToken: 'bad-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Não foi possível verificar o login com Apple.' })
  })

  it('rejects when Apple did not share an email', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({ appleUserId: 'apple-1', email: null })
    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Sua conta Apple não compartilhou um e-mail. Tente outra forma de entrar.',
    })
  })

  it('creates a new consumer on first sign-in, using the shared full name', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({ appleUserId: 'apple-1', email: 'Maria@Example.com' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1', name: 'Maria Silva', email: 'maria@example.com', role: 'CONSUMER', blocked: false,
    } as never)
    vi.mocked(createMobileSession).mockResolvedValue('token-123')

    const response = await POST(
      request({ idToken: 'good-token', fullName: { givenName: 'Maria', familyName: 'Silva' } }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      token: 'token-123',
      user: { id: 'user-1', name: 'Maria Silva', email: 'maria@example.com' },
    })
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'maria@example.com', name: 'Maria Silva', role: 'CONSUMER', passwordHash: null },
    })
  })

  it('falls back to the email prefix as name when no full name is shared', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({ appleUserId: 'apple-1', email: 'maria@example.com' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1', name: 'maria', email: 'maria@example.com', role: 'CONSUMER', blocked: false,
    } as never)
    vi.mocked(createMobileSession).mockResolvedValue('token-123')

    await POST(request({ idToken: 'good-token' }))

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'maria' }) }),
    )
  })

  it('logs in an existing consumer instead of creating a duplicate', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({ appleUserId: 'apple-1', email: 'maria@example.com' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', name: 'Maria', email: 'maria@example.com', role: 'CONSUMER', blocked: false,
    } as never)
    vi.mocked(createMobileSession).mockResolvedValue('token-123')

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(200)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a blocked user', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({ appleUserId: 'apple-1', email: 'maria@example.com' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', name: 'Maria', email: 'maria@example.com', role: 'CONSUMER', blocked: true,
    } as never)

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Conta bloqueada.' })
  })

  it('rejects an existing non-consumer account (merchant/admin) logging in via the app', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({ appleUserId: 'apple-1', email: 'joao@bigburger.com.br' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', name: 'João', email: 'joao@bigburger.com.br', role: 'MERCHANT', blocked: false,
    } as never)

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Esta conta não pode entrar pelo aplicativo.' })
  })
})
