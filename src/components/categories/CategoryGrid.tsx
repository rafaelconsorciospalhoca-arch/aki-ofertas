import Link from 'next/link'

export function CategoryGrid({
  categories,
}: {
  categories: { id: string; name: string; icon: string }[]
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/ofertas?categoria=${category.id}`}
          className="flex flex-col items-center gap-1 text-center"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-sm">
            {category.icon.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[10px] leading-tight text-neutral-600">{category.name}</span>
        </Link>
      ))}
    </div>
  )
}
