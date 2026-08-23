import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getBusinessForOwner, getMyOffers } from '@/lib/merchant'
import { centsToReais } from '@/lib/money'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativa',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
}

export default async function ComercianteOfertasPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const offers = await getMyOffers(business.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Ofertas</h1>
        <Link
          href="/comerciante/ofertas/nova"
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
        >
          + Nova oferta
        </Link>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-neutral-500">Você ainda não publicou nenhuma oferta.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Oferta</th>
                <th className="px-4 py-2">Preço</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{offer.title}</td>
                  <td className="px-4 py-3 text-neutral-600">R$ {centsToReais(offer.discountPrice)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-600">
                      {STATUS_LABEL[offer.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/comerciante/ofertas/${offer.id}`} className="text-xs font-bold text-brand-green">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
