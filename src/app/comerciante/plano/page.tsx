import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { getPaidPlans } from '@/lib/plans'
import { PlanoForm } from '@/components/merchant/PlanoForm'

function daysLeft(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null
  const ms = trialEndsAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export default async function ComerciantePlanoPage({
  searchParams,
}: {
  searchParams: { pago?: string }
}) {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  const plans = await getPaidPlans()
  const pago = searchParams.pago

  if (!business) {
    return (
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Meu plano</h1>
        <p className="mt-2 text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
      </div>
    )
  }

  const trialDays = daysLeft(business.trialEndsAt)

  return (
    <div className="flex flex-col gap-6">
      {pago ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Pagamento em processamento! Assim que confirmado, seu plano será ativado.
        </div>
      ) : null}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Meu plano</h1>
        {business.status === 'SUSPENDED' ? (
          <p className="mt-1 text-sm text-red-600">Seu acesso está bloqueado até você assinar um plano.</p>
        ) : trialDays !== null ? (
          <p className="mt-1 text-sm text-neutral-500">
            {trialDays > 0 ? `Seu período de teste termina em ${trialDays} dia${trialDays === 1 ? '' : 's'}.` : 'Seu período de teste termina hoje.'}
          </p>
        ) : null}
      </div>

      <PlanoForm plans={plans} initialDocument={business.document ?? ''} />
    </div>
  )
}
