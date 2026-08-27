import Link from 'next/link'
import { CategoryIcon } from '@/components/categories/CategoryIcon'

export function CategoriesShowcase({
  categories,
}: {
  categories: { id: string; name: string; icon: string }[]
}) {
  if (categories.length === 0) return null

  return (
    <section className="bg-neutral-50 px-4 py-14">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-extrabold text-neutral-900">O que você encontra</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/ofertas?categoria=${category.id}`}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center shadow-sm"
            >
              <CategoryIcon icon={category.icon} className="h-12 w-12" />
              <span className="text-xs font-semibold text-neutral-700">{category.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
