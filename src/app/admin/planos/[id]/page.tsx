import { notFound } from 'next/navigation'
import { getPlanById } from '@/lib/admin'
import { PlanForm } from '@/components/admin/PlanForm'

export default async function EditarPlanoPage({ params }: { params: { id: string } }) {
  const plan = await getPlanById(params.id)
  if (!plan) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar plano</h1>
      <PlanForm
        planId={plan.id}
        initialValues={{
          name: plan.name,
          priceReais: (plan.priceCents / 100).toFixed(2),
          maxOffersPerMonth: String(plan.maxOffersPerMonth),
          hasFlashOffers: plan.hasFlashOffers,
          hasFullMetrics: plan.hasFullMetrics,
        }}
      />
    </div>
  )
}
