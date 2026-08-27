import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createOrderForUser,
  getOrdersForUser,
  getOrdersForBusiness,
  getOrderForBusiness,
  updateOrderStatusForBusiness,
} from '@/lib/orders'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    offer: { findUnique: vi.fn() },
    order: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/email', () => ({
  sendNewOrderEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
}))

// order.findFirst is shared by getOrderForBusiness and updateOrderStatusForBusiness's
// lookup — each describe block below sets its own mock, isolated by afterEach.

const activeOffer = {
  id: 'offer-1',
  title: 'Combo Burguer',
  status: 'ACTIVE',
  deliveryEnabled: true,
  startDate: new Date('2020-01-01'),
  endDate: new Date('2030-01-01'),
  business: {
    id: 'biz-1',
    name: 'Big Burger',
    status: 'ACTIVE',
    email: null,
    owner: { blocked: false, email: 'dono@bigburger.com' },
  },
}

const validInput = {
  offerId: 'offer-1',
  quantity: 2,
  phone: '5546999990000',
  address: 'Rua das Flores, 10',
  city: 'Marmeleiro',
  state: 'pr',
}

const orderRowFixture = {
  id: 'order-1',
  quantity: 2,
  phone: '5546999990000',
  address: 'Rua das Flores, 10',
  number: null,
  neighborhood: null,
  city: 'Marmeleiro',
  state: 'PR',
  zip: null,
  notes: null,
  status: 'PENDING',
  createdAt: new Date('2026-01-01'),
  offerId: 'offer-1',
  businessId: 'biz-1',
  offer: { title: 'Combo Burguer', slug: 'combo-burguer', discountPrice: 2990 },
  business: { name: 'Big Burger', slug: 'big-burger' },
  user: { name: 'Maria' },
}

describe('createOrderForUser', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the offer does not exist', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue(null)

    const result = await createOrderForUser('user-1', validInput)
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('rejects when the business is not ACTIVE', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      ...activeOffer,
      business: { ...activeOffer.business, status: 'PENDING' },
    } as never)

    const result = await createOrderForUser('user-1', validInput)
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('rejects when the owner is blocked', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      ...activeOffer,
      business: { ...activeOffer.business, owner: { blocked: true } },
    } as never)

    const result = await createOrderForUser('user-1', validInput)
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('rejects when the offer does not accept delivery', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({ ...activeOffer, deliveryEnabled: false } as never)

    const result = await createOrderForUser('user-1', validInput)
    expect(result).toEqual({ ok: false, error: 'Esta oferta não aceita entrega.' })
  })

  it('rejects when the offer is outside its active date window', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      ...activeOffer,
      startDate: new Date('2020-01-01'),
      endDate: new Date('2020-02-01'),
    } as never)

    const result = await createOrderForUser('user-1', validInput)
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('creates the order, uppercasing the state', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue(activeOffer as never)
    vi.mocked(prisma.order.create).mockResolvedValue({ id: 'order-1', user: { name: 'Maria' } } as never)

    const result = await createOrderForUser('user-1', validInput)

    expect(result).toEqual({ ok: true, orderId: 'order-1' })
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        offerId: 'offer-1',
        businessId: 'biz-1',
        quantity: 2,
        phone: '5546999990000',
        address: 'Rua das Flores, 10',
        number: null,
        neighborhood: null,
        city: 'Marmeleiro',
        state: 'PR',
        zip: null,
        notes: null,
      },
      include: { user: { select: { name: true } } },
    })
  })

  it('notifies the business by email using the business email over the owner email', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      ...activeOffer,
      business: { ...activeOffer.business, email: 'contato@bigburger.com' },
    } as never)
    vi.mocked(prisma.order.create).mockResolvedValue({ id: 'order-1', user: { name: 'Maria' } } as never)
    const { sendNewOrderEmail } = await import('@/lib/email')

    await createOrderForUser('user-1', validInput)

    expect(sendNewOrderEmail).toHaveBeenCalledWith('contato@bigburger.com', {
      offerTitle: 'Combo Burguer',
      quantity: 2,
      customerName: 'Maria',
      phone: '5546999990000',
      address: 'Rua das Flores, 10',
    })
  })

  it('falls back to the owner email when the business has none', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue(activeOffer as never)
    vi.mocked(prisma.order.create).mockResolvedValue({ id: 'order-1', user: { name: 'Maria' } } as never)
    const { sendNewOrderEmail } = await import('@/lib/email')

    await createOrderForUser('user-1', validInput)

    expect(sendNewOrderEmail).toHaveBeenCalledWith('dono@bigburger.com', expect.anything())
  })
})

describe('getOrdersForUser', () => {
  afterEach(() => vi.clearAllMocks())

  it('maps order rows for the given user', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([orderRowFixture] as never)

    const result = await getOrdersForUser('user-1')

    expect(result).toEqual([
      {
        id: 'order-1',
        quantity: 2,
        phone: '5546999990000',
        address: 'Rua das Flores, 10',
        number: null,
        neighborhood: null,
        city: 'Marmeleiro',
        state: 'PR',
        zip: null,
        notes: null,
        status: 'PENDING',
        createdAt: new Date('2026-01-01'),
        offerId: 'offer-1',
        offerTitle: 'Combo Burguer',
        offerSlug: 'combo-burguer',
        discountPrice: 2990,
        businessId: 'biz-1',
        businessName: 'Big Burger',
        businessSlug: 'big-burger',
        customerName: 'Maria',
      },
    ])
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
  })
})

describe('getOrdersForBusiness', () => {
  afterEach(() => vi.clearAllMocks())

  it('queries orders scoped to the business', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([orderRowFixture] as never)

    const result = await getOrdersForBusiness('biz-1')

    expect(result).toHaveLength(1)
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'biz-1' } }),
    )
  })
})

describe('getOrderForBusiness', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns null when the order does not belong to this business', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    const result = await getOrderForBusiness('order-1', 'biz-1')
    expect(result).toBeNull()
  })

  it('returns the mapped order when it belongs to this business', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(orderRowFixture as never)

    const result = await getOrderForBusiness('order-1', 'biz-1')
    expect(result?.id).toBe('order-1')
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', businessId: 'biz-1' } }),
    )
  })
})

describe('updateOrderStatusForBusiness', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the order does not belong to this business', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    const result = await updateOrderStatusForBusiness('biz-1', 'order-1', 'CONFIRMED')
    expect(result).toEqual({ ok: false, error: 'Pedido não encontrado.' })
  })

  it('rejects an invalid status transition', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({ id: 'order-1', status: 'PENDING' } as never)

    const result = await updateOrderStatusForBusiness('biz-1', 'order-1', 'DELIVERED')
    expect(result).toEqual({ ok: false, error: 'Não é possível mudar para esse status a partir do atual.' })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('allows a valid status transition', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      user: { email: 'maria@example.com' },
      offer: { title: 'Combo Burguer' },
      business: { name: 'Big Burger' },
    } as never)
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order-1' } as never)

    const result = await updateOrderStatusForBusiness('biz-1', 'order-1', 'CONFIRMED')

    expect(result).toEqual({ ok: true })
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { status: 'CONFIRMED' } })
  })

  it('notifies the customer by email when the status changes', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      user: { email: 'maria@example.com' },
      offer: { title: 'Combo Burguer' },
      business: { name: 'Big Burger' },
    } as never)
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order-1' } as never)
    const { sendOrderStatusEmail } = await import('@/lib/email')

    await updateOrderStatusForBusiness('biz-1', 'order-1', 'CONFIRMED')

    expect(sendOrderStatusEmail).toHaveBeenCalledWith('maria@example.com', {
      offerTitle: 'Combo Burguer',
      businessName: 'Big Burger',
      status: 'CONFIRMED',
    })
  })

  it('allows cancelling from any non-terminal status', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order-1',
      status: 'OUT_FOR_DELIVERY',
      user: { email: 'maria@example.com' },
      offer: { title: 'Combo Burguer' },
      business: { name: 'Big Burger' },
    } as never)
    vi.mocked(prisma.order.update).mockResolvedValue({ id: 'order-1' } as never)

    const result = await updateOrderStatusForBusiness('biz-1', 'order-1', 'CANCELLED')
    expect(result).toEqual({ ok: true })
  })
})
