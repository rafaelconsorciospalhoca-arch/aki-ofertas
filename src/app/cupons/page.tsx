import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getCouponsForUser } from '@/lib/coupons'

const STATUS_LABEL: Record<string, string> = {
  VALID: 'Válido',
  USED: 'Utilizado',
  EXPIRED: 'Expirado',
}

const STATUS_CLASS: Record<string, string> = {
  VALID: 'bg-brand-green/10 text-brand-green',
  USED: 'bg-neutral-100 text-neutral-500',
  EXPIRED: 'bg-red-50 text-red-500',
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

export default async function CuponsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/entrar?callbackUrl=/cupons')
  }

  const coupons = await getCouponsForUser(session.user.id as string)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold text-neutral-900">Meus cupons</h1>

      {coupons.length === 0 ? (
        <p className="text-sm text-neutral-500">Você ainda não gerou nenhum cupom.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-neutral-900">{coupon.offerTitle}</p>
                  <p className="text-xs text-neutral-500">{coupon.businessName}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_CLASS[coupon.status]}`}>
                  {STATUS_LABEL[coupon.status]}
                </span>
              </div>
              <p className="mt-3 text-center text-xl font-bold tracking-widest text-neutral-900">{coupon.code}</p>
              <p className="mt-1 text-center text-xs text-neutral-500">Válido até {formatDate(coupon.expiresAt)}</p>
              <Link href={`/oferta/${coupon.offerSlug}`} className="mt-2 block text-center text-xs font-bold text-brand-green">
                Ver oferta
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
