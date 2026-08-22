import { cookies } from 'next/headers'
import { getActiveCategories } from '@/lib/categories'
import { getFeaturedOffers } from '@/lib/offers'
import { GEO_COOKIE, parseGeoCookie } from '@/lib/location'
import { CategoryGrid } from '@/components/categories/CategoryGrid'
import { OfferCard } from '@/components/offers/OfferCard'

export default async function HomePage() {
  const location = parseGeoCookie(cookies().get(GEO_COOKIE)?.value)
  const [categories, offers] = await Promise.all([
    getActiveCategories(),
    getFeaturedOffers({ location, limit: 10 }),
  ])

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Aki Ofertas</h1>
        <p className="text-sm text-neutral-500">O que você precisa, pertinho de você.</p>
      </div>

      <CategoryGrid categories={categories} />

      <div>
        <h2 className="mb-2 text-sm font-bold text-neutral-900">Ofertas em destaque</h2>
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
  )
}
