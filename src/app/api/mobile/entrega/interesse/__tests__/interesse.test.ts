import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from '@/app/api/mobile/entrega/interesse/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { prisma } from '@/lib/db'
import { sendDeliveryZoneRequestEmail } from '@/lib/email'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { business: { findUnique: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendDeliveryZoneRequestEmail: vi.fn().mockResolvedValue(undefined) }))

function postRequest(body: unknown) {
  return new Request('https://example.com/api/mobile/entrega/interesse', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validBody = { businessId: 'biz-1', neighborhood: 'Vila Nova' }

describe('POST /api/mobile/entrega/interesse', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(401)
  })

  it('rejects invalid input', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await POST(postRequest({ businessId: 'biz-1', neighborhood: 'X' }))
    expect(response.status).toBe(400)
  })

  it('returns 404 when the business does not exist', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(404)
  })

  it('sends the request email to the business email when present', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      name: 'Big Burger',
      email: 'contato@bigburger.com',
      owner: { email: 'dono@bigburger.com' },
    } as never)

    const response = await POST(postRequest(validBody))

    expect(response.status).toBe(200)
    expect(sendDeliveryZoneRequestEmail).toHaveBeenCalledWith('contato@bigburger.com', {
      businessName: 'Big Burger',
      neighborhood: 'Vila Nova',
    })
  })

  it('falls back to the owner email when the business has none', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      name: 'Big Burger',
      email: null,
      owner: { email: 'dono@bigburger.com' },
    } as never)

    await POST(postRequest(validBody))

    expect(sendDeliveryZoneRequestEmail).toHaveBeenCalledWith('dono@bigburger.com', expect.anything())
  })
})
