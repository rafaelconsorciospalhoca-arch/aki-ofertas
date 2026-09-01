import { getOffersForAdmin } from '@/lib/admin'
import { OfferFeaturedToggle } from '@/components/admin/OfferFeaturedToggle'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminOfertasPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const offers = await getOffersForAdmin(searchParams.q)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Ofertas</h1>
        <p className="text-sm text-neutral-500">
          Escolha quais ofertas aparecem no carrossel de destaque da tela inicial do app.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar por oferta ou empresa..."
          className="w-full max-w-sm rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white">
          Buscar
        </button>
      </form>

      {offers.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma oferta encontrada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-bold text-neutral-900">{offer.title}</p>
                <p className="text-xs text-neutral-500">
                  {offer.business.name} · {offer.business.city} - {offer.business.state}
                </p>
                <p className="text-xs text-neutral-500">
                  De {formatCents(offer.originalPrice)} por {formatCents(offer.discountPrice)} (-{offer.discountPercent}%)
                </p>
                {offer.featured && (
                  <span className="mt-1 inline-block rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-bold text-brand-green">
                    Em destaque
                  </span>
                )}
              </div>
              <OfferFeaturedToggle offerId={offer.id} featured={offer.featured} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
