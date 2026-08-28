'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPlan, updatePlan } from '@/actions/admin-actions'

type Values = {
  name: string
  priceReais: string
  maxOffersPerMonth: string
  hasFlashOffers: boolean
  hasFullMetrics: boolean
}

export function PlanForm({ planId, initialValues }: { planId?: string; initialValues?: Values }) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(
    initialValues ?? { name: '', priceReais: '', maxOffersPerMonth: '', hasFlashOffers: false, hasFullMetrics: false },
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = planId ? await updatePlan(planId, values) : await createPlan(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/planos')
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nome
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Preço mensal (R$)
        <input
          type="number"
          step="0.01"
          min="0"
          value={values.priceReais}
          onChange={(e) => update('priceReais', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Máximo de ofertas ativas
        <input
          type="number"
          min="0"
          value={values.maxOffersPerMonth}
          onChange={(e) => update('maxOffersPerMonth', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.hasFlashOffers} onChange={(e) => update('hasFlashOffers', e.target.checked)} />
        Ofertas relâmpago
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.hasFullMetrics} onChange={(e) => update('hasFullMetrics', e.target.checked)} />
        Métricas completas
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : planId ? 'Salvar alterações' : 'Criar plano'}
      </button>
    </form>
  )
}
