import { CityForm } from '@/components/admin/CityForm'

export default function NovaCidadePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Nova cidade</h1>
      <CityForm />
    </div>
  )
}
