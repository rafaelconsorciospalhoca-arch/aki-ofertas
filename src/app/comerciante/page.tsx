import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getBusinessForOwner, getMyOffers } from '@/lib/merchant'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando aprovação',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  REJECTED: 'Reprovada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default async function ComercianteDashboardPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return (
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Painel do comerciante</h1>
        <p className="mt-2 text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
      </div>
    )
  }

  const offers = await getMyOffers(business.id)
  const activeCount = offers.filter((offer) => offer.status === 'ACTIVE').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Olá, {session!.user!.name}!</h1>
          <p className="text-sm text-neutral-500">Veja o desempenho da sua empresa.</p>
        </div>
        <Link
          href="/comerciante/ofertas/nova"
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
        >
          + Nova oferta
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <p className="font-bold text-neutral-900">{business.name}</p>
          <p className="text-sm text-neutral-500">{business.category.name}</p>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[business.status]}`}>
          {STATUS_LABEL[business.status]}
        </span>
      </div>

      {business.status === 'PENDING' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Sua empresa está aguardando aprovação do administrador. Suas ofertas só aparecerão para os consumidores
          depois disso.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Ofertas ativas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Total de ofertas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{offers.length}</p>
        </div>
      </div>

      <Link href="/comerciante/ofertas" className="text-sm font-bold text-brand-green">
        Ver todas as ofertas →
      </Link>
    </div>
  )
}
