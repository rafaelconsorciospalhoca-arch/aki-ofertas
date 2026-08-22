import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/businesses'
import { OfferCard } from '@/components/offers/OfferCard'
import { StoreTabs } from '@/components/stores/StoreTabs'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export default async function LojaPage({ params }: { params: { slug: string } }) {
  const business = await getBusinessBySlug(params.slug)

  if (!business) {
    notFound()
  }

  const aboutContent = (
    <div className="flex flex-col gap-3 text-sm text-neutral-600">
      <p className="leading-relaxed">{business.description ?? 'Este estabelecimento ainda não adicionou uma descrição.'}</p>
      <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
        <p className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="#17A94E" strokeWidth={2.2} className="h-4 w-4 flex-shrink-0">
            <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2" />
          </svg>
          {business.city} - {business.state}
        </p>
        {business.phone && (
          <p className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#17A94E" strokeWidth={2.2} className="h-4 w-4 flex-shrink-0">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 3a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c1 .4 2 .6 3 .7a2 2 0 0 1 1.7 2Z" />
            </svg>
            {business.phone}
          </p>
        )}
      </div>
    </div>
  )

  const offersContent =
    business.offers.length === 0 ? (
      <p className="py-6 text-center text-sm text-neutral-500">Nenhuma oferta ativa no momento.</p>
    ) : (
      <div className="flex flex-col gap-2">
        {business.offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    )

  return (
    <div className="flex flex-col pb-6">
      <div className="relative h-36 w-full flex-shrink-0 bg-brand-navy">
        {business.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.coverUrl} alt={business.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <Link
          href="/"
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm"
          aria-label="Voltar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#0B1B33" strokeWidth={2.4} className="h-4 w-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <h1 className="text-lg font-bold leading-tight">{business.name}</h1>
          <p className="text-xs text-neutral-200">{business.categoryName}</p>
        </div>
      </div>

      {business.whatsapp && (
        <div className="flex gap-2 border-b border-neutral-200 p-3">
          <a
            href={`https://wa.me/${digitsOnly(business.whatsapp)}`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-green px-3 py-2 text-xs font-bold text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            WhatsApp
          </a>
          <button
            type="button"
            disabled
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
              <circle cx="6" cy="12" r="2.4" />
              <circle cx="18" cy="6" r="2.4" />
              <circle cx="18" cy="18" r="2.4" />
              <path d="M8.2 10.8 15.8 7M8.2 13.2l7.6 3.8" />
            </svg>
            Compartilhar
          </button>
        </div>
      )}

      <StoreTabs about={aboutContent} ofertas={offersContent} />
    </div>
  )
}
