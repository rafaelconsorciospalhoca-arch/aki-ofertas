import { getAllCities, getAllCategories } from '@/lib/admin'
import { getAdminReportSummary, getAdminOrderRows, getAdminCityBreakdown } from '@/lib/admin-reports'
import { Tabs } from '@/components/ui/Tabs'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('pt-BR')
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

export default async function AdminRelatoriosPage({
  searchParams,
}: {
  searchParams: { de?: string; ate?: string; cidade?: string; categoria?: string }
}) {
  const from = searchParams.de ? new Date(`${searchParams.de}T00:00:00`) : undefined
  const to = searchParams.ate ? new Date(`${searchParams.ate}T23:59:59`) : undefined
  const filters = { from, to, city: searchParams.cidade || undefined, categoryId: searchParams.categoria || undefined }

  const [cities, categories, summary, orders, cityBreakdown] = await Promise.all([
    getAllCities(),
    getAllCategories(),
    getAdminReportSummary(filters),
    getAdminOrderRows(filters),
    getAdminCityBreakdown(filters),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Relatórios</h1>
        <p className="text-sm text-neutral-500">Visão geral da plataforma: pedidos, cupons e faturamento.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
          De
          <input type="date" name="de" defaultValue={searchParams.de ?? ''} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
          Até
          <input type="date" name="ate" defaultValue={searchParams.ate ?? ''} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
          Cidade
          <select name="cidade" defaultValue={searchParams.cidade ?? ''} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            {cities.map((city) => (
              <option key={city.id} value={city.name}>
                {city.name} - {city.state}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
          Categoria
          <select name="categoria" defaultValue={searchParams.categoria ?? ''} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white">
          Filtrar
        </button>
        {(searchParams.de || searchParams.ate || searchParams.cidade || searchParams.categoria) && (
          <a href="/admin/relatorios" className="text-xs font-bold text-neutral-500 underline">
            Limpar filtros
          </a>
        )}
      </form>

      <Tabs
        tabs={[
          {
            id: 'resumo',
            label: 'Resumo',
            content: (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">Empresas ativas</p>
                  <p className="text-xl font-bold text-neutral-900">{summary.activeBusinesses}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">Pedidos no período</p>
                  <p className="text-xl font-bold text-neutral-900">{summary.totalOrders}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">Entregues</p>
                  <p className="text-xl font-bold text-emerald-600">{summary.ordersByStatus.DELIVERED}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">Cancelados</p>
                  <p className="text-xl font-bold text-red-600">{summary.ordersByStatus.CANCELLED}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">Faturamento (entregues)</p>
                  <p className="text-xl font-bold text-neutral-900">{formatCents(summary.deliveredRevenueCents)}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">Cupons gerados / usados</p>
                  <p className="text-xl font-bold text-neutral-900">
                    {summary.totalCouponsGenerated} / {summary.totalCouponsUsed}
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: 'cidades',
            label: 'Por cidade',
            content:
              cityBreakdown.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhum pedido no período selecionado.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                      <tr>
                        <th className="px-4 py-2">Cidade</th>
                        <th className="px-4 py-2">Pedidos</th>
                        <th className="px-4 py-2">Faturamento (entregues)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityBreakdown.map((row) => (
                        <tr key={`${row.city}-${row.state}`} className="border-b border-neutral-100 last:border-0">
                          <td className="px-4 py-3 font-medium text-neutral-900">
                            {row.city}/{row.state}
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{row.orders}</td>
                          <td className="px-4 py-3 text-neutral-600">{formatCents(row.deliveredRevenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
          },
          {
            id: 'pedidos',
            label: `Pedidos${orders.length === 200 ? ' (últimos 200)' : ''}`,
            content:
              orders.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhum pedido no período selecionado.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                      <tr>
                        <th className="px-4 py-2">Empresa</th>
                        <th className="px-4 py-2">Oferta</th>
                        <th className="px-4 py-2">Cliente</th>
                        <th className="px-4 py-2">Total</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Cidade</th>
                        <th className="px-4 py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                          <td className="px-4 py-3 font-medium text-neutral-900">{order.businessName}</td>
                          <td className="px-4 py-3 text-neutral-600">{order.offerTitle}</td>
                          <td className="px-4 py-3 text-neutral-600">{order.customerName}</td>
                          <td className="px-4 py-3 text-neutral-600">{formatCents(order.totalCents)}</td>
                          <td className="px-4 py-3 text-neutral-600">{STATUS_LABEL[order.status] ?? order.status}</td>
                          <td className="px-4 py-3 text-neutral-600">
                            {order.city}/{order.state}
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{formatDate(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
          },
        ]}
      />
    </div>
  )
}
