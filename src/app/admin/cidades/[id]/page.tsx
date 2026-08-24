import { notFound } from 'next/navigation'
import { getCityById } from '@/lib/admin'
import { CityForm } from '@/components/admin/CityForm'

export default async function EditarCidadePage({ params }: { params: { id: string } }) {
  const city = await getCityById(params.id)
  if (!city) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar cidade</h1>
      <CityForm
        cityId={city.id}
        initialValues={{
          name: city.name,
          state: city.state,
          active: city.active,
          comingSoon: city.comingSoon,
        }}
      />
    </div>
  )
}
