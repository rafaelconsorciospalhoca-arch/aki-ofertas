import Link from 'next/link'
import type { OfferListItem } from '@/lib/offers'

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function OfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Link
      href={`/oferta/${offer.slug}`}
      className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-2 transition-colors active:bg-neutral-50"
    >
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
        {offer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">
              <path d="M20.6 12L12 20.6 3.4 12 12 3.4z" />
            </svg>
          </div>
        )}
        <span className="absolute left-1 top-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          -{offer.discountPercent}%
        </span>
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="truncate text-sm font-bold text-neutral-900">{offer.title}</h3>
        <p className="truncate text-xs text-neutral-500">{offer.businessName}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-xs text-neutral-400 line-through">{formatCents(offer.originalPrice)}</span>
          <span className="text-base font-bold text-brand-green">{formatCents(offer.discountPrice)}</span>
        </div>
        {offer.distanceLabel && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
              <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
              <circle cx="12" cy="9.5" r="2" />
            </svg>
            {offer.distanceLabel}
          </p>
        )}
      </div>
    </Link>
  )
}
