import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOfferBySlug } from '@/lib/offers'
import { getCouponForOffer, getCouponsCountForOffer } from '@/lib/coupons'
import { auth } from '@/lib/auth'
import { formatCents } from '@/components/offers/OfferCard'
import { GenerateCouponButton } from '@/components/offers/GenerateCouponButton'

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

export default async function OfertaPage({ params }: { params: { slug: string } }) {
  const offer = await getOfferBySlug(params.slug)

  if (!offer) {
    notFound()
  }

  const session = await auth()
  const soldOut =
    offer.quantityAvailable !== null &&
    (await getCouponsCountForOffer(offer.id)) >= offer.quantityAvailable
  const existingCoupon = session?.user
    ? await getCouponForOffer(session.user.id as string, offer.id)
    : null

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <div className="relative h-56 w-full flex-shrink-0 bg-neutral-200">
        {offer.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 text-neutral-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-14 w-14">
              <path d="M20.6 12L12 20.6 3.4 12 12 3.4z" />
            </svg>
          </div>
        )}
        <Link
          href="/"
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm"
          aria-label="Voltar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#0B1B33" strokeWidth={2.4} className="h-4 w-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="absolute bottom-3 left-3 rounded-lg bg-red-500 px-3 py-1 text-lg font-bold text-white shadow-sm">
          -{offer.discountPercent}%
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Link href={`/loja/${offer.business.slug}`} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
          {offer.business.name}
        </Link>
        <h1 className="text-xl font-bold text-neutral-900">{offer.title}</h1>
        {offer.description && <p className="text-sm leading-relaxed text-neutral-600">{offer.description}</p>}

        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-base text-neutral-400 line-through">{formatCents(offer.originalPrice)}</span>
          <span className="text-2xl font-bold text-brand-green">{formatCents(offer.discountPrice)}</span>
        </div>

        <div className="flex flex-col gap-1.5 pt-1 text-xs text-neutral-500">
          <p className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 flex-shrink-0">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
            Válido até {formatDate(offer.endDate)}
          </p>
          {offer.quantityAvailable !== null && (
            <p className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 flex-shrink-0">
                <rect x="3" y="7" width="18" height="14" rx="2" />
                <path d="M3 7l9-4 9 4" />
              </svg>
              {offer.quantityAvailable} disponíveis
            </p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-200 bg-white p-4">
        {session?.user ? (
          <GenerateCouponButton
            offerId={offer.id}
            initialCoupon={existingCoupon ? { code: existingCoupon.code } : null}
            soldOut={soldOut}
          />
        ) : (
          <Link
            href={`/entrar?callbackUrl=/oferta/${params.slug}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-3 text-sm font-bold text-white"
          >
            Entrar para gerar cupom
          </Link>
        )}
      </div>
    </div>
  )
}
