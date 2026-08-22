import Link from 'next/link'
import { cookies } from 'next/headers'
import { getActiveCategories } from '@/lib/categories'
import { getOffersList } from '@/lib/offers'
import { GEO_COOKIE, parseGeoCookie } from '@/lib/location'
import { OfferCard } from '@/components/offers/OfferCard'

const RADIUS_OPTIONS = [1, 3, 5, 10, 20]

function buildFilterHref(categoria: string | undefined, raio: number | undefined) {
  const params = new URLSearchParams()
  if (categoria) params.set('categoria', categoria)
  if (raio) params.set('raio', String(raio))
  const query = params.toString()
  return query ? `/ofertas?${query}` : '/ofertas'
}

export default async function OfertasPage({
  searchParams,
}: {
  searchParams: { categoria?: string; raio?: string }
}) {
  const location = parseGeoCookie(cookies().get(GEO_COOKIE)?.value)
  const radiusKm = searchParams.raio ? Number(searchParams.raio) : undefined

  const [categories, offers] = await Promise.all([
    getActiveCategories(),
    getOffersList({
      categoryId: searchParams.categoria,
      location,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
    }),
  ])

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold text-neutral-900">Ofertas perto de você</h1>

      <div className="flex gap-2 overflow-x-auto">
        <Link
          href={buildFilterHref(undefined, radiusKm)}
          className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
            !searchParams.categoria ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          Todas
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={buildFilterHref(category.id, radiusKm)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              searchParams.categoria === category.id ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      {location && (
        <div className="flex gap-2 overflow-x-auto">
          <Link
            href={buildFilterHref(searchParams.categoria, undefined)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs ${
              !radiusKm ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            Toda cidade
          </Link>
          {RADIUS_OPTIONS.map((km) => (
            <Link
              key={km}
              href={buildFilterHref(searchParams.categoria, km)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs ${
                radiusKm === km ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              Até {km} km
            </Link>
          ))}
        </div>
      )}

      {offers.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma oferta encontrada com esses filtros.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  )
}
