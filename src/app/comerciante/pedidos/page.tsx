import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { getOrdersForBusiness } from '@/lib/orders'
import { OrderManager } from '@/components/merchant/OrderManager'

export const dynamic = 'force-dynamic'

export default async function ComerciantePedidosPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const orders = await getOrdersForBusiness(business.id)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Pedidos</h1>
      <OrderManager orders={orders} />
    </div>
  )
}
