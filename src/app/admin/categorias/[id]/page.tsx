import { notFound } from 'next/navigation'
import { getCategoryById } from '@/lib/admin'
import { CategoryForm } from '@/components/admin/CategoryForm'

export default async function EditarCategoriaPage({ params }: { params: { id: string } }) {
  const category = await getCategoryById(params.id)
  if (!category) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar categoria</h1>
      <CategoryForm
        categoryId={category.id}
        initialValues={{
          name: category.name,
          icon: category.icon,
          order: String(category.order),
          active: category.active,
        }}
      />
    </div>
  )
}
