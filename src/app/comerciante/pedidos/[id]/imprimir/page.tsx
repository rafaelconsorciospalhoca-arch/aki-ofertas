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

const PAYMENT_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  FOOD_VOUCHER: 'Cartão Alimentação',
  MEAL_VOUCHER: 'Cartão Refeição',
  CASH: 'Dinheiro',
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
    <div className="mx-auto max-w-sm p-6 font-mono text-sm text-black print:mx-0 print:max-w-none print:p-2 print:text-xs">
      {/* Thermal receipt printers use their own driver page size (80mm roll),
          not A4/Letter — without this the browser centers the 80mm content
          on a full A4 page, wasting paper and confusing some drivers. */}
      <style>{'@page { size: 80mm auto; margin: 0; }'}</style>
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
      {order.deliveryFeeCents ? <p>Taxa de entrega: R$ {centsToReais(order.deliveryFeeCents)}</p> : null}
      <p className="font-bold">
        Total: R$ {centsToReais(order.discountPrice * order.quantity + (order.deliveryFeeCents ?? 0) + (order.optionsFeeCents ?? 0))}
      </p>
      <hr className="my-3 border-dashed border-black" />
      <p className="font-bold">Pagamento: {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</p>
      {order.paymentMethod === 'CASH' && order.changeForCents && (
        <p className="font-bold">Troco para: R$ {centsToReais(order.changeForCents)}</p>
      )}
      {order.selectedOptions && (
        <>
          <hr className="my-3 border-dashed border-black" />
          <p>Opções: {order.selectedOptions}</p>
        </>
      )}
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
