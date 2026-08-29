import { prisma } from '@/lib/db'
import type { OrderStatus } from '@prisma/client'
import { sendNewOrderEmail, sendOrderStatusEmail } from '@/lib/email'

export type OrderRow = {
  id: string
  quantity: number
  phone: string
  address: string
  number: string | null
  neighborhood: string | null
  deliveryFeeCents: number | null
  city: string
  state: string
  zip: string | null
  notes: string | null
  status: OrderStatus
  createdAt: Date
  offerId: string
  offerTitle: string
  offerSlug: string
  discountPrice: number
  businessId: string
  businessName: string
  businessSlug: string
  customerName: string
}

const orderInclude = {
  offer: { select: { title: true, slug: true, discountPrice: true } },
  business: { select: { name: true, slug: true } },
  user: { select: { name: true } },
} as const

function toOrderRow(row: {
  id: string
  quantity: number
  phone: string
  address: string
  number: string | null
  neighborhood: string | null
  deliveryFeeCents: number | null
  city: string
  state: string
  zip: string | null
  notes: string | null
  status: OrderStatus
  createdAt: Date
  offerId: string
  businessId: string
  offer: { title: string; slug: string; discountPrice: number }
  business: { name: string; slug: string }
  user: { name: string }
}): OrderRow {
  return {
    id: row.id,
    quantity: row.quantity,
    phone: row.phone,
    address: row.address,
    number: row.number,
    neighborhood: row.neighborhood,
    deliveryFeeCents: row.deliveryFeeCents,
    city: row.city,
    state: row.state,
    zip: row.zip,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt,
    offerId: row.offerId,
    offerTitle: row.offer.title,
    offerSlug: row.offer.slug,
    discountPrice: row.offer.discountPrice,
    businessId: row.businessId,
    businessName: row.business.name,
    businessSlug: row.business.slug,
    customerName: row.user.name,
  }
}

export async function getOrdersForUser(userId: string): Promise<OrderRow[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toOrderRow)
}

export async function getOrdersForBusiness(businessId: string): Promise<OrderRow[]> {
  const rows = await prisma.order.findMany({
    where: { businessId },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toOrderRow)
}

export async function getOrderForBusiness(orderId: string, businessId: string): Promise<OrderRow | null> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: orderInclude,
  })
  return row ? toOrderRow(row) : null
}

export type CreateOrderInput = {
  offerId: string
  quantity: number
  phone: string
  address: string
  number?: string
  deliveryZoneId: string
  city: string
  state: string
  zip?: string
  notes?: string
}

export type CreateOrderResult = { ok: true; orderId: string } | { ok: false; error: string }

const OFFER_NOT_AVAILABLE = 'Oferta não encontrada.'
const DELIVERY_NOT_AVAILABLE = 'Esta oferta não aceita entrega.'
const ZONE_NOT_AVAILABLE = 'Bairro inválido ou indisponível.'

export async function createOrderForUser(userId: string, input: CreateOrderInput): Promise<CreateOrderResult> {
  const offer = await prisma.offer.findUnique({
    where: { id: input.offerId },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          status: true,
          email: true,
          owner: { select: { blocked: true, email: true } },
        },
      },
    },
  })

  if (!offer || offer.status !== 'ACTIVE') {
    return { ok: false, error: OFFER_NOT_AVAILABLE }
  }
  if (offer.business.status !== 'ACTIVE' || offer.business.owner.blocked) {
    return { ok: false, error: OFFER_NOT_AVAILABLE }
  }
  if (!offer.deliveryEnabled) {
    return { ok: false, error: DELIVERY_NOT_AVAILABLE }
  }

  const zone = await prisma.deliveryZone.findFirst({
    where: { id: input.deliveryZoneId, businessId: offer.business.id, active: true },
  })
  if (!zone) {
    return { ok: false, error: ZONE_NOT_AVAILABLE }
  }

  const now = new Date()
  if (offer.startDate > now || offer.endDate < now) {
    return { ok: false, error: OFFER_NOT_AVAILABLE }
  }

  const order = await prisma.order.create({
    data: {
      userId,
      offerId: offer.id,
      businessId: offer.business.id,
      quantity: input.quantity,
      phone: input.phone,
      address: input.address,
      number: input.number || null,
      neighborhood: zone.neighborhood,
      deliveryFeeCents: zone.feeCents,
      city: input.city,
      state: input.state.toUpperCase(),
      zip: input.zip || null,
      notes: input.notes || null,
    },
    include: { user: { select: { name: true } } },
  })

  const notifyEmail = offer.business.email || offer.business.owner.email
  if (notifyEmail) {
    sendNewOrderEmail(notifyEmail, {
      offerTitle: offer.title,
      quantity: input.quantity,
      customerName: order.user.name,
      phone: input.phone,
      address: input.address,
    }).catch((err) => console.error('Failed to send new order email', err))
  }

  return { ok: true, orderId: order.id }
}

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
}

export type UpdateOrderStatusResult = { ok: true } | { ok: false; error: string }

export async function updateOrderStatusForBusiness(
  businessId: string,
  orderId: string,
  status: OrderStatus,
): Promise<UpdateOrderStatusResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: {
      user: { select: { email: true } },
      offer: { select: { title: true } },
      business: { select: { name: true } },
    },
  })
  if (!order) {
    return { ok: false, error: 'Pedido não encontrado.' }
  }
  if (!NEXT_STATUS[order.status].includes(status)) {
    return { ok: false, error: 'Não é possível mudar para esse status a partir do atual.' }
  }

  await prisma.order.update({ where: { id: orderId }, data: { status } })

  sendOrderStatusEmail(order.user.email, {
    offerTitle: order.offer.title,
    businessName: order.business.name,
    status,
  }).catch((err) => console.error('Failed to send order status email', err))

  return { ok: true }
}
