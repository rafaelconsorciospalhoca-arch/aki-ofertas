import { CategoryForm } from '@/components/admin/CategoryForm'

export default function NovaCategoriaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Nova categoria</h1>
      <CategoryForm />
    </div>
  )
}
