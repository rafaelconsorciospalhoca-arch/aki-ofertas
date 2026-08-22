import { notFound } from 'next/navigation'
import { getOfferBySlug } from '@/lib/offers'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

export default async function OfertaPage({ params }: { params: { slug: string } }) {
  const offer = await getOfferBySlug(params.slug)

  if (!offer) {
    notFound()
  }

  return (
    <div className="flex flex-col">
      <div className="relative h-48 w-full bg-neutral-200">
        {offer.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
        )}
        <span className="absolute bottom-3 left-3 rounded-lg bg-red-500 px-3 py-1 text-lg font-bold text-white">
          -{offer.discountPercent}%
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-neutral-500">{offer.business.name}</p>
        <h1 className="text-xl font-bold text-neutral-900">{offer.title}</h1>
        {offer.description && <p className="text-sm text-neutral-600">{offer.description}</p>}

        <div className="flex items-baseline gap-2">
          <span className="text-base text-neutral-400 line-through">{formatCents(offer.originalPrice)}</span>
          <span className="text-2xl font-bold text-emerald-600">{formatCents(offer.discountPrice)}</span>
        </div>

        <p className="text-xs text-neutral-500">
          Válido até {formatDate(offer.endDate)}
          {offer.quantityAvailable !== null && ` · ${offer.quantityAvailable} disponíveis`}
        </p>

        <button
          type="button"
          disabled
          className="mt-2 w-full rounded-lg bg-neutral-200 px-4 py-3 text-sm font-bold text-neutral-500"
        >
          Usar cupom (em breve)
        </button>
      </div>
    </div>
  )
}
