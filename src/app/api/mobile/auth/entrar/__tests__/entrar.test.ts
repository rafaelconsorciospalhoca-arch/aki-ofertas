import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/entrar/route'
import { prisma } from '@/lib/db'
import { createMobileSession } from '@/lib/mobile-session'
import { sendSignupConfirmationEmail } from '@/lib/email'

vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/mobile-session', () => ({ createMobileSession: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendSignupConfirmationEmail: vi.fn() }))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/entrar', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/mobile/auth/entrar', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects an invalid email', async () => {
    const response = await POST(request({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
  })

  it('rejects a new user missing any of name/city/state/phone', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const response = await POST(request({ email: 'novo@example.com', name: 'Maria' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Informe seus dados para continuar.' })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('creates a new user, logs them in, and sends the confirmation email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-1', name: 'Maria', email: 'novo@example.com', blocked: false, role: 'CONSUMER',
    } as never)
    vi.mocked(createMobileSession).mockResolvedValue('token-1')
    vi.mocked(sendSignupConfirmationEmail).mockResolvedValue(undefined)

    const response = await POST(
      request({ email: 'NOVO@example.com', name: 'Maria', city: 'Marmeleiro', state: 'pr', phone: '5546999990000' }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      token: 'token-1',
      user: { id: 'user-1', name: 'Maria', email: 'novo@example.com' },
    })
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'novo@example.com',
        name: 'Maria',
        city: 'Marmeleiro',
        state: 'PR',
        phone: '5546999990000',
        role: 'CONSUMER',
        passwordHash: null,
      },
    })
    expect(sendSignupConfirmationEmail).toHaveBeenCalledWith('novo@example.com', 'Maria')
  })

  it('logs in an existing CONSUMER without requiring name/city/state/phone', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', name: 'Maria', email: 'existe@example.com', blocked: false, role: 'CONSUMER',
    } as never)
    vi.mocked(createMobileSession).mockResolvedValue('token-1')

    const response = await POST(request({ email: 'existe@example.com' }))

    expect(response.status).toBe(200)
    expect(sendSignupConfirmationEmail).not.toHaveBeenCalled()
  })

  it('rejects a blocked account', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', name: 'Maria', email: 'bloqueado@example.com', blocked: true, role: 'CONSUMER',
    } as never)

    const response = await POST(request({ email: 'bloqueado@example.com' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Conta bloqueada.' })
  })

  it('rejects an existing non-CONSUMER account', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', name: 'João', email: 'merchant@example.com', blocked: false, role: 'MERCHANT',
    } as never)

    const response = await POST(request({ email: 'merchant@example.com' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Esta conta não pode entrar pelo aplicativo.' })
  })
})
