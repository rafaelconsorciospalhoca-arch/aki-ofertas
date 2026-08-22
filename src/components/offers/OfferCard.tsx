import Link from 'next/link'
import type { OfferListItem } from '@/lib/offers'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function OfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Link
      href={`/oferta/${offer.slug}`}
      className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-2"
    >
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {offer.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
        )}
        <span className="absolute left-1 top-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          -{offer.discountPercent}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-neutral-900">{offer.title}</h3>
        <p className="truncate text-xs text-neutral-500">{offer.businessName}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-xs text-neutral-400 line-through">{formatCents(offer.originalPrice)}</span>
          <span className="text-base font-bold text-emerald-600">{formatCents(offer.discountPrice)}</span>
        </div>
        {offer.distanceLabel && (
          <p className="mt-0.5 text-xs text-neutral-400">📍 {offer.distanceLabel}</p>
        )}
      </div>
    </Link>
  )
}
