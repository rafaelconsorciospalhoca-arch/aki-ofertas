import Link from 'next/link'
import { getAllPlans } from '@/lib/admin'

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminPlanosPage() {
  const plans = await getAllPlans()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Planos</h1>
        <Link href="/admin/planos/nova" className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white">
          + Novo plano
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Preço</th>
              <th className="px-4 py-2">Ofertas</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">{plan.name}</td>
                <td className="px-4 py-3 text-neutral-600">{formatPrice(plan.priceCents)}/mês</td>
                <td className="px-4 py-3 text-neutral-600">{plan.maxOffersPerMonth}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/planos/${plan.id}`} className="text-xs font-bold text-brand-green">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
