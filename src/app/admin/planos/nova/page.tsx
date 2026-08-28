import { PlanForm } from '@/components/admin/PlanForm'

export default function NovoPlanoPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Novo plano</h1>
      <PlanForm />
    </div>
  )
}
