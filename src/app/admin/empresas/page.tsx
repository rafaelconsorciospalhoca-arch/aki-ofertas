import Link from 'next/link'
import { getBusinessesForAdmin } from '@/lib/admin'
import { BusinessStatusActions } from '@/components/admin/BusinessStatusActions'
import type { BusinessStatus } from '@prisma/client'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando aprovação',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  REJECTED: 'Reprovada',
}

const FILTERS: { value: BusinessStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Todas' },
  { value: 'PENDING', label: 'Aguardando' },
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'SUSPENDED', label: 'Suspensas' },
  { value: 'REJECTED', label: 'Reprovadas' },
]

export default async function AdminEmpresasPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const validStatuses = FILTERS.map((filter) => filter.value).filter(Boolean)
  const status = validStatuses.includes(searchParams.status as BusinessStatus)
    ? (searchParams.status as BusinessStatus)
    : undefined
  const businesses = await getBusinessesForAdmin(status)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Empresas</h1>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/empresas?status=${filter.value}` : '/admin/empresas'}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              status === filter.value ? 'bg-brand-navy text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {businesses.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma empresa encontrada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {businesses.map((business) => (
            <div
              key={business.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-bold text-neutral-900">{business.name}</p>
                <p className="text-xs text-neutral-500">
                  {business.category.name} · {business.city} - {business.state}
                </p>
                <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                  {STATUS_LABEL[business.status]}
                </span>
              </div>
              <BusinessStatusActions businessId={business.id} status={business.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
