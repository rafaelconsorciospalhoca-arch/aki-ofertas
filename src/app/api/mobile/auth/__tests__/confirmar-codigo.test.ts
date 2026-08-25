import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/confirmar-codigo/route'
import { prisma } from '@/lib/db'
import { verifyOtpCode } from '@/lib/mobile-auth'
import { createMobileSession } from '@/lib/mobile-session'

vi.mock('@/lib/db', () => ({
  prisma: {
    emailOtp: { findFirst: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/mobile-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mobile-auth')>('@/lib/mobile-auth')
  return { ...actual, verifyOtpCode: vi.fn() }
})

vi.mock('@/lib/mobile-session', () => ({
  createMobileSession: vi.fn(),
}))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/confirmar-codigo', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validOtp = { id: 'otp-1', email: 'user@example.com', codeHash: 'hash', attempts: 0, expiresAt: new Date(Date.now() + 100000) }

describe('POST /api/mobile/auth/confirmar-codigo', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid body', async () => {
    const response = await POST(request({ email: 'not-an-email', code: '123456' }))
    expect(response.status).toBe(400)
  })

  it('rejects when there is no pending code for the email', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(null)
    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Código inválido.' })
  })

  it('rejects an expired code', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue({ ...validOtp, expiresAt: new Date(Date.now() - 1000) } as never)
    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Código expirado.' })
  })

  it('rejects after too many failed attempts', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue({ ...validOtp, attempts: 5 } as never)
    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Código inválido.' })
  })

  it('increments attempts on a wrong code', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(false)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)

    const response = await POST(request({ email: 'user@example.com', code: '000000' }))

    expect(response.status).toBe(400)
    expect(prisma.emailOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'otp-1' }, data: { attempts: { increment: 1 } } }),
    )
  })

  it('rejects a new user without a name', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Informe seu nome.' })
  })

  it('creates a new user and returns a token', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ email: 'user@example.com', code: '123456', name: 'Maria' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true, token: 'a-token', user: { id: 'user-1', name: 'Maria', email: 'user@example.com' },
    })
    const data = vi.mocked(prisma.user.create).mock.calls[0][0].data
    expect(data.role).toBe('CONSUMER')
    expect(data.passwordHash).toBeNull()
  })

  it('logs in an existing user without requiring a name', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(200)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a blocked user', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: true } as never)

    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Conta bloqueada.' })
  })
})
