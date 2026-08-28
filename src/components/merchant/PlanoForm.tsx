'use client'

import { useState } from 'react'
import { subscribeToPlan } from '@/actions/merchant-actions'

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PlanoForm({
  plans,
  initialDocument,
}: {
  plans: { id: string; name: string; priceCents: number }[]
  initialDocument: string
}) {
  const [document, setDocument] = useState(initialDocument)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(planId: string) {
    setError(null)
    setPendingPlanId(planId)
    try {
      const result = await subscribeToPlan(planId, document)
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.location.href = result.invoiceUrl
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setPendingPlanId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-neutral-700">
        CPF ou CNPJ
        <input
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Necessário pra assinar um plano"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-center">
            <p className="text-sm font-bold text-neutral-900">{plan.name}</p>
            <p className="text-2xl font-extrabold text-brand-green">{formatPrice(plan.priceCents)}/mês</p>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={pendingPlanId !== null || !document.trim()}
              className="mt-2 w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
            >
              {pendingPlanId === plan.id ? 'Redirecionando...' : 'Assinar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
