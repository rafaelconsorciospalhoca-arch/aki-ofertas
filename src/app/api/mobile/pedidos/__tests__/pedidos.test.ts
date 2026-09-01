import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET, POST } from '@/app/api/mobile/pedidos/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { createOrderForUser, getOrdersForUser } from '@/lib/orders'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/orders', () => ({ createOrderForUser: vi.fn(), getOrdersForUser: vi.fn() }))

function postRequest(body: unknown) {
  return new Request('https://example.com/api/mobile/pedidos', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validBody = {
  offerId: 'offer-1',
  quantity: 2,
  phone: '5546999990000',
  address: 'Rua das Flores, 10',
  deliveryZoneId: 'zone-1',
  city: 'Marmeleiro',
  state: 'PR',
  paymentMethod: 'PIX',
}

describe('GET /api/mobile/pedidos', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await GET(new Request('https://example.com/api/mobile/pedidos'))
    expect(response.status).toBe(401)
  })

  it('returns the orders for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(getOrdersForUser).mockResolvedValue([{ id: 'order-1' }] as never)

    const response = await GET(new Request('https://example.com/api/mobile/pedidos'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'order-1' }] })
    expect(getOrdersForUser).toHaveBeenCalledWith('user-1')
  })
})

describe('POST /api/mobile/pedidos', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(401)
  })

  it('rejects invalid input', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await POST(postRequest({ ...validBody, quantity: 0 }))
    expect(response.status).toBe(400)
    expect(createOrderForUser).not.toHaveBeenCalled()
  })

  it('creates the order for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(createOrderForUser).mockResolvedValue({ ok: true, orderId: 'order-1' })

    const response = await POST(postRequest(validBody))

    expect(response.status).toBe(200)
    expect(createOrderForUser).toHaveBeenCalledWith('user-1', validBody)
  })

  it('surfaces a business error from createOrderForUser with a 400', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(createOrderForUser).mockResolvedValue({ ok: false, error: 'Esta oferta não aceita entrega.' })

    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(400)
  })
})
