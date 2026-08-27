import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { getOrderForBusiness } from '@/lib/orders'
import { centsToReais } from '@/lib/money'
import { AutoPrint } from '@/components/merchant/AutoPrint'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

export default async function ImprimirPedidoPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  if (!business) {
    notFound()
  }

  const order = await getOrderForBusiness(params.id, business.id)
  if (!order) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-sm p-6 font-mono text-sm text-black">
      <AutoPrint />
      <h1 className="text-center text-base font-bold">{business.name}</h1>
      <p className="text-center text-xs">Pedido #{order.id.slice(-8).toUpperCase()}</p>
      <hr className="my-3 border-dashed border-black" />
      <p>Cliente: {order.customerName}</p>
      <p>Telefone: {order.phone}</p>
      <p>
        Endereço: {order.address}
        {order.number ? `, ${order.number}` : ''}
        {order.neighborhood ? ` - ${order.neighborhood}` : ''}
      </p>
      <p>
        {order.city}/{order.state}
      </p>
      <hr className="my-3 border-dashed border-black" />
      <p>
        {order.quantity}x {order.offerTitle}
      </p>
      <p>Valor unitário: R$ {centsToReais(order.discountPrice)}</p>
      <p className="font-bold">Total: R$ {centsToReais(order.discountPrice * order.quantity)}</p>
      {order.notes && (
        <>
          <hr className="my-3 border-dashed border-black" />
          <p>Obs: {order.notes}</p>
        </>
      )}
      <hr className="my-3 border-dashed border-black" />
      <p>Status: {STATUS_LABEL[order.status] ?? order.status}</p>
      <p>Data: {new Date(order.createdAt).toLocaleString('pt-BR')}</p>
    </div>
  )
}
