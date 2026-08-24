import Link from 'next/link'
import { getPlatformStats, getBusinessesForAdmin } from '@/lib/admin'

export default async function AdminDashboardPage() {
  const [stats, pendingBusinesses] = await Promise.all([
    getPlatformStats(),
    getBusinessesForAdmin('PENDING'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Visão geral</h1>
        <p className="text-sm text-neutral-500">Acompanhe o crescimento da plataforma.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Usuários</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Empresas ativas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.activeBusinesses}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Aguardando aprovação</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pendingBusinesses}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Ofertas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalOffers}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Cidades</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalCities}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Total de empresas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalBusinesses}</p>
        </div>
      </div>

      {pendingBusinesses.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">Empresas aguardando aprovação</h2>
            <Link href="/admin/empresas?status=PENDING" className="text-xs font-bold text-brand-green">
              Ver todas
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {pendingBusinesses.slice(0, 5).map((business) => (
              <div
                key={business.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-bold text-neutral-900">{business.name}</p>
                  <p className="text-xs text-neutral-500">
                    {business.city} - {business.state} · {business.category.name}
                  </p>
                </div>
                <Link href="/admin/empresas?status=PENDING" className="text-xs font-bold text-brand-green">
                  Revisar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
