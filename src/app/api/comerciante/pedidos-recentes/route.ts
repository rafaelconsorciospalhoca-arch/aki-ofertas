import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'

// Polled client-side by OrderNotificationWatcher (mounted in the merchant
// dashboard's persistent layout) so a new delivery order plays a sound and
// shows a banner no matter which page of the panel the merchant is on — not
// just while they're looking at /comerciante/pedidos. Only PENDING orders
// are returned: the watcher re-alerts every poll while any exist, and stops
// as soon as the merchant confirms or cancels them all.
export async function GET() {
  const business = await requireMerchantBusiness()
  if (!business) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: { businessId: business.id, status: 'PENDING' },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ ok: true, data: orders.map((order) => order.id) })
}
