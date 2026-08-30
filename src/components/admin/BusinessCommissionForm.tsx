'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusinessCommissionOverride } from '@/actions/admin-actions'

type Mode = 'CATEGORY_DEFAULT' | 'FORCE_PERCENT' | 'FORCE_NONE'

export function BusinessCommissionForm({
  businessId,
  categoryPercent,
  initialMode,
  initialPercent,
}: {
  businessId: string
  categoryPercent: number | null
  initialMode: Mode
  initialPercent: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [percent, setPercent] = useState(initialPercent)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const result = await updateBusinessCommissionOverride(businessId, { mode, percent })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(true)
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-bold text-neutral-900">Comissão de entrega</h2>
      <p className="text-xs text-neutral-500">
        Padrão da categoria: {categoryPercent !== null ? `${categoryPercent}%` : 'sem comissão'}
      </p>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="radio" name="mode" checked={mode === 'CATEGORY_DEFAULT'} onChange={() => setMode('CATEGORY_DEFAULT')} />
        Usar padrão da categoria
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="radio" name="mode" checked={mode === 'FORCE_PERCENT'} onChange={() => setMode('FORCE_PERCENT')} />
        Forçar comissão de
        <input
          type="number"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => {
            setPercent(e.target.value)
            setMode('FORCE_PERCENT')
          }}
          className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
        />
        %
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="radio" name="mode" checked={mode === 'FORCE_NONE'} onChange={() => setMode('FORCE_NONE')} />
        Forçar mensalidade (sem comissão)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Salvo.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
