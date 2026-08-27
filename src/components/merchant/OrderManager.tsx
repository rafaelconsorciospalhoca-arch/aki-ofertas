'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateOrderStatus } from '@/actions/order-actions'
import { centsToReais } from '@/lib/money'

type Order = {
  id: string
  quantity: number
  phone: string
  address: string
  number: string | null
  neighborhood: string | null
  city: string
  state: string
  notes: string | null
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

  async function handleStatusChange(orderId: string, status: string) {
    setPendingId(orderId)
    try {
      await updateOrderStatus(orderId, status)
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
            <p className="col-span-2">Telefone: {order.phone}</p>
            <p className="col-span-2">
              Endereço: {order.address}
              {order.number ? `, ${order.number}` : ''}
              {order.neighborhood ? ` - ${order.neighborhood}` : ''}, {order.city}/{order.state}
            </p>
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
          </div>
        </div>
      ))}
    </div>
  )
}
