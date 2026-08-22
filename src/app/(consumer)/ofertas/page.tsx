import Link from 'next/link'
import { cookies } from 'next/headers'
import { getActiveCategories } from '@/lib/categories'
import { getOffersList } from '@/lib/offers'
import { GEO_COOKIE, parseGeoCookie, CITY_COOKIE, parseCityCookie } from '@/lib/location'
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
  const city = location ? null : parseCityCookie(cookies().get(CITY_COOKIE)?.value)
  const radiusKm = searchParams.raio ? Number(searchParams.raio) : undefined

  const [categories, offers] = await Promise.all([
    getActiveCategories(),
    getOffersList({
      categoryId: searchParams.categoria,
      location,
      city,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
    }),
  ])

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold text-neutral-900">Ofertas perto de você</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        <Link
          href={buildFilterHref(undefined, radiusKm)}
          className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
            !searchParams.categoria ? 'bg-brand-green text-white' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          Todas
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={buildFilterHref(category.id, radiusKm)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              searchParams.categoria === category.id ? 'bg-brand-green text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      {location && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <Link
            href={buildFilterHref(searchParams.categoria, undefined)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              !radiusKm ? 'bg-brand-navy text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            Toda cidade
          </Link>
          {RADIUS_OPTIONS.map((km) => (
            <Link
              key={km}
              href={buildFilterHref(searchParams.categoria, km)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                radiusKm === km ? 'bg-brand-navy text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              Até {km} km
            </Link>
          ))}
        </div>
      )}

      {offers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 py-10 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-neutral-300">
            <path d="M20.6 12L12 20.6 3.4 12 12 3.4z" />
          </svg>
          <p className="text-sm text-neutral-500">Nenhuma oferta encontrada com esses filtros.</p>
        </div>
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
