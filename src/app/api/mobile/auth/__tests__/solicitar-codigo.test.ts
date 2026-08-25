import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/solicitar-codigo/route'
import { prisma } from '@/lib/db'
import { sendOtpEmail } from '@/lib/email'

vi.mock('@/lib/db', () => ({
  prisma: {
    emailOtp: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/email', () => ({
  sendOtpEmail: vi.fn(),
}))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/solicitar-codigo', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/mobile/auth/solicitar-codigo', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid email', async () => {
    const response = await POST(request({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects when a code was requested in the last 60 seconds', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue({ id: 'otp-1' } as never)

    const response = await POST(request({ email: 'user@example.com' }))
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: 'Aguarde antes de pedir um novo código.' })
  })

  it('rejects when the daily limit was reached', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.emailOtp.count).mockResolvedValue(5)

    const response = await POST(request({ email: 'user@example.com' }))
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' })
  })

  it('creates an OTP and sends the email on success', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.emailOtp.count).mockResolvedValue(0)
    vi.mocked(prisma.emailOtp.create).mockResolvedValue({} as never)

    const response = await POST(request({ email: 'user@example.com' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })

    expect(prisma.emailOtp.create).toHaveBeenCalledTimes(1)
    const data = vi.mocked(prisma.emailOtp.create).mock.calls[0][0].data
    expect(data.email).toBe('user@example.com')
    expect(data.codeHash).not.toMatch(/^\d{6}$/)

    expect(sendOtpEmail).toHaveBeenCalledWith('user@example.com', expect.stringMatching(/^\d{6}$/))
  })
})
