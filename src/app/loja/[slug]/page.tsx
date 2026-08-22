import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/businesses'
import { OfferCard } from '@/components/offers/OfferCard'
import { StoreTabs } from '@/components/stores/StoreTabs'

export default async function LojaPage({ params }: { params: { slug: string } }) {
  const business = await getBusinessBySlug(params.slug)

  if (!business) {
    notFound()
  }

  const aboutContent = (
    <div className="flex flex-col gap-2 text-sm text-neutral-600">
      <p>{business.description ?? 'Este estabelecimento ainda não adicionou uma descrição.'}</p>
      <p>
        <span className="font-bold text-neutral-900">Endereço: </span>
        {business.city} - {business.state}
      </p>
      {business.whatsapp && (
        <p>
          <span className="font-bold text-neutral-900">WhatsApp: </span>
          {business.whatsapp}
        </p>
      )}
    </div>
  )

  const offersContent =
    business.offers.length === 0 ? (
      <p className="text-sm text-neutral-500">Nenhuma oferta ativa no momento.</p>
    ) : (
      <div className="flex flex-col gap-2">
        {business.offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    )

  return (
    <div className="flex flex-col">
      <div className="relative h-32 w-full bg-neutral-800">
        {business.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.coverUrl} alt={business.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute bottom-3 left-4 text-white">
          <h1 className="text-lg font-bold">{business.name}</h1>
          <p className="text-xs text-neutral-200">{business.categoryName}</p>
        </div>
      </div>
      <StoreTabs about={aboutContent} ofertas={offersContent} />
    </div>
  )
}
