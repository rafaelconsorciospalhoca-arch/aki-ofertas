import Link from 'next/link'
import { CategoryIcon } from './CategoryIcon'

export function CategoryGrid({
  categories,
}: {
  categories: { id: string; name: string; icon: string }[]
}) {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/ofertas?categoria=${category.id}`}
          className="flex flex-col items-center gap-1.5 text-center"
        >
          <CategoryIcon icon={category.icon} className="h-11 w-11" />
          <span className="text-[11px] font-medium leading-tight text-neutral-600">{category.name}</span>
        </Link>
      ))}
    </div>
  )
}
