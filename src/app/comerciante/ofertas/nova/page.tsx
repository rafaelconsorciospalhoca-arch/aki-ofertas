import { getActiveCategories } from '@/lib/categories'
import { OfferForm } from '@/components/merchant/OfferForm'

export default async function NovaOfertaPage() {
  const categories = await getActiveCategories()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Nova oferta</h1>
      <OfferForm categories={categories} />
    </div>
  )
}
