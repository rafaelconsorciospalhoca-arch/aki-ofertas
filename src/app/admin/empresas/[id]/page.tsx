import { notFound } from 'next/navigation'
import { getBusinessById } from '@/lib/admin'
import { BusinessCommissionForm } from '@/components/admin/BusinessCommissionForm'

export default async function AdminEmpresaDetailPage({ params }: { params: { id: string } }) {
  const business = await getBusinessById(params.id)
  if (!business) {
    notFound()
  }

  const initialMode = business.commissionOverrideEnabled
    ? business.commissionOverridePercent !== null
      ? 'FORCE_PERCENT'
      : 'FORCE_NONE'
    : 'CATEGORY_DEFAULT'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{business.name}</h1>
        <p className="text-sm text-neutral-500">
          {business.category.name} · {business.owner.name} ({business.owner.email})
        </p>
      </div>
      <BusinessCommissionForm
        businessId={business.id}
        categoryPercent={business.category.commissionPercent}
        initialMode={initialMode}
        initialPercent={business.commissionOverridePercent !== null ? String(business.commissionOverridePercent) : ''}
      />
    </div>
  )
}
