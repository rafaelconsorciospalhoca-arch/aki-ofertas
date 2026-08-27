import Link from 'next/link'
import { cookies } from 'next/headers'
import { getActiveCategories, getCitiesWithActiveBusinesses } from '@/lib/categories'
import { getFeaturedOffers } from '@/lib/offers'
import { GEO_COOKIE, parseGeoCookie, CITY_COOKIE, parseCityCookie } from '@/lib/location'
import { CategoryGrid } from '@/components/categories/CategoryGrid'
import { OfferCard } from '@/components/offers/OfferCard'
import { LandingPage } from '@/components/landing/LandingPage'

export default async function HomePage() {
  const location = parseGeoCookie(cookies().get(GEO_COOKIE)?.value)
  const city = location ? null : parseCityCookie(cookies().get(CITY_COOKIE)?.value)

  if (!location && !city) {
    const [categories, cities] = await Promise.all([getActiveCategories(), getCitiesWithActiveBusinesses()])
    return <LandingPage categories={categories} cities={cities} />
  }

  const [categories, offers] = await Promise.all([
    getActiveCategories(),
    getFeaturedOffers({ location, city, limit: 10 }),
  ])

  return (
    <div className="flex flex-col">
      <div className="bg-brand-navy px-4 pb-6 pt-5 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-green">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" fill="#0A1830" />
              <circle cx="12" cy="9.5" r="2.4" fill="#fff" />
            </svg>
          </span>
          <div>
            <p className="text-base font-bold leading-tight">
              Aki <span className="text-brand-green-light">Ofertas</span>
            </p>
            {city ? (
              <p className="text-[11px] text-neutral-300">📍 {city.name} · {city.state}</p>
            ) : (
              <p className="text-[11px] text-neutral-300">O que você precisa, pertinho de você.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <CategoryGrid categories={categories} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">Ofertas em destaque</h2>
            <Link href="/ofertas" className="text-xs font-bold text-brand-green">
              Ver todas
            </Link>
          </div>
          {offers.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma oferta disponível no momento.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {offers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
