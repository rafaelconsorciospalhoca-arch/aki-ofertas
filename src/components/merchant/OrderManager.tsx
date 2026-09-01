'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateOrderStatus, deleteOrder } from '@/actions/order-actions'
import { centsToReais } from '@/lib/money'

type Order = {
  id: string
  quantity: number
  phone: string
  address: string
  number: string | null
  neighborhood: string | null
  deliveryFeeCents: number | null
  city: string
  state: string
  notes: string | null
  selectedOptions: string | null
  optionsFeeCents: number | null
  paymentMethod: string
  changeForCents: number | null
  status: string
  createdAt: Date
  offerTitle: string
  discountPrice: number
  customerName: string
}

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

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirmar' },
    { status: 'CANCELLED', label: 'Cancelar' },
  ],
  CONFIRMED: [
    { status: 'PREPARING', label: 'Iniciar preparo' },
    { status: 'CANCELLED', label: 'Cancelar' },
  ],
  PREPARING: [
    { status: 'OUT_FOR_DELIVERY', label: 'Saiu para entrega' },
    { status: 'CANCELLED', label: 'Cancelar' },
  ],
  OUT_FOR_DELIVERY: [
    { status: 'DELIVERED', label: 'Marcar como entregue' },
    { status: 'CANCELLED', label: 'Cancelar' },
  ],
  DELIVERED: [],
  CANCELLED: [],
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('pt-BR')
}

export function OrderManager({ orders }: { orders: Order[] & { id: string }[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 20_000)
    return () => clearInterval(interval)
  }, [router])

  async function handleStatusChange(orderId: string, status: string) {
    setPendingId(orderId)
    try {
      await updateOrderStatus(orderId, status)
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete(orderId: string) {
    if (!window.confirm('Excluir este pedido? Essa ação não pode ser desfeita.')) return
    setPendingId(orderId)
    try {
      await deleteOrder(orderId)
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  if (orders.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum pedido com entrega recebido ainda.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <div key={order.id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-neutral-900">{order.offerTitle}</p>
              <p className="text-xs text-neutral-500">
                {order.customerName} · {formatDate(order.createdAt)}
              </p>
            </div>
            <span className="whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-600">
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-neutral-600">
            <p>Qtd: {order.quantity}</p>
            <p>Valor un.: R$ {centsToReais(order.discountPrice)}</p>
            {order.deliveryFeeCents ? (
              <p>Taxa de entrega: R$ {centsToReais(order.deliveryFeeCents)}</p>
            ) : null}
            <p className="font-bold">
              Total: R$ {centsToReais(order.discountPrice * order.quantity + (order.deliveryFeeCents ?? 0) + (order.optionsFeeCents ?? 0))}
            </p>
            <p className="col-span-2 font-bold">
              Pagamento: {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
              {order.paymentMethod === 'CASH' && order.changeForCents
                ? ` (troco para R$ ${centsToReais(order.changeForCents)})`
                : ''}
            </p>
            <p className="col-span-2">Telefone: {order.phone}</p>
            <p className="col-span-2">
              Endereço: {order.address}
              {order.number ? `, ${order.number}` : ''}
              {order.neighborhood ? ` - ${order.neighborhood}` : ''}, {order.city}/{order.state}
            </p>
            {order.selectedOptions && <p className="col-span-2">Opções: {order.selectedOptions}</p>}
            {order.notes && <p className="col-span-2">Obs: {order.notes}</p>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {NEXT_STATUS[order.status]?.map((next) => (
              <button
                key={next.status}
                type="button"
                disabled={pendingId === order.id}
                onClick={() => handleStatusChange(order.id, next.status)}
                className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {next.label}
              </button>
            ))}
            <Link
              href={`/comerciante/pedidos/${order.id}/imprimir`}
              target="_blank"
              className="text-xs font-bold text-neutral-500 underline"
            >
              Imprimir
            </Link>
            <button
              type="button"
              disabled={pendingId === order.id}
              onClick={() => handleDelete(order.id)}
              className="text-xs font-bold text-red-600 underline disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
