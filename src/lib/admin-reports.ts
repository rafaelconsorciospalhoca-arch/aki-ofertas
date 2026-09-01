import { prisma } from '@/lib/db'
import type { OrderStatus, Prisma } from '@prisma/client'

export type AdminReportFilters = {
  from?: Date
  to?: Date
  city?: string
  categoryId?: string
}

function orderWhere(filters: AdminReportFilters): Prisma.OrderWhereInput {
  return {
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.categoryId ? { offer: { categoryId: filters.categoryId } } : {}),
  }
}

function couponWhere(filters: AdminReportFilters): Prisma.CouponWhereInput {
  return {
    ...(filters.from || filters.to
      ? {
          generatedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.city ? { business: { city: filters.city } } : {}),
    ...(filters.categoryId ? { offer: { categoryId: filters.categoryId } } : {}),
  }
}

export type AdminReportSummary = {
  activeBusinesses: number
  totalOrders: number
  ordersByStatus: Record<OrderStatus, number>
  deliveredRevenueCents: number
  totalCouponsGenerated: number
  totalCouponsUsed: number
}

export async function getAdminReportSummary(filters: AdminReportFilters): Promise<AdminReportSummary> {
  const [businessCount, orders, couponsGenerated, couponsUsed] = await Promise.all([
    prisma.business.count({
      where: {
        status: 'ACTIVE',
        ...(filters.city ? { city: filters.city } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      },
    }),
    prisma.order.findMany({
      where: orderWhere(filters),
      select: {
        status: true,
        quantity: true,
        deliveryFeeCents: true,
        optionsFeeCents: true,
        offer: { select: { discountPrice: true } },
      },
    }),
    prisma.coupon.count({ where: couponWhere(filters) }),
    prisma.coupon.count({ where: { ...couponWhere(filters), status: 'USED' } }),
  ])

  const ordersByStatus: Record<OrderStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    PREPARING: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  }
  let deliveredRevenueCents = 0
  for (const order of orders) {
    ordersByStatus[order.status]++
    if (order.status === 'DELIVERED') {
      deliveredRevenueCents +=
        order.offer.discountPrice * order.quantity + (order.deliveryFeeCents ?? 0) + (order.optionsFeeCents ?? 0)
    }
  }

  return {
    activeBusinesses: businessCount,
    totalOrders: orders.length,
    ordersByStatus,
    deliveredRevenueCents,
    totalCouponsGenerated: couponsGenerated,
    totalCouponsUsed: couponsUsed,
  }
}

export type AdminOrderRow = {
  id: string
  businessName: string
  offerTitle: string
  customerName: string
  totalCents: number
  status: OrderStatus
  city: string
  state: string
  createdAt: Date
}

const ORDER_ROW_LIMIT = 200

export async function getAdminOrderRows(filters: AdminReportFilters): Promise<AdminOrderRow[]> {
  const rows = await prisma.order.findMany({
    where: orderWhere(filters),
    orderBy: { createdAt: 'desc' },
    take: ORDER_ROW_LIMIT,
    include: {
      business: { select: { name: true } },
      offer: { select: { title: true, discountPrice: true } },
      user: { select: { name: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    businessName: row.business.name,
    offerTitle: row.offer.title,
    customerName: row.user.name,
    totalCents: row.offer.discountPrice * row.quantity + (row.deliveryFeeCents ?? 0) + (row.optionsFeeCents ?? 0),
    status: row.status,
    city: row.city,
    state: row.state,
    createdAt: row.createdAt,
  }))
}

export type CityBreakdownRow = { city: string; state: string; orders: number; deliveredRevenueCents: number }

export async function getAdminCityBreakdown(filters: AdminReportFilters): Promise<CityBreakdownRow[]> {
  const orders = await prisma.order.findMany({
    where: orderWhere(filters),
    select: {
      city: true,
      state: true,
      status: true,
      quantity: true,
      deliveryFeeCents: true,
      optionsFeeCents: true,
      offer: { select: { discountPrice: true } },
    },
  })

  const map = new Map<string, CityBreakdownRow>()
  for (const order of orders) {
    const key = `${order.city}|${order.state}`
    const existing = map.get(key) ?? { city: order.city, state: order.state, orders: 0, deliveredRevenueCents: 0 }
    existing.orders++
    if (order.status === 'DELIVERED') {
      existing.deliveredRevenueCents +=
        order.offer.discountPrice * order.quantity + (order.deliveryFeeCents ?? 0) + (order.optionsFeeCents ?? 0)
    }
    map.set(key, existing)
  }

  return Array.from(map.values()).sort((a, b) => b.orders - a.orders)
}
