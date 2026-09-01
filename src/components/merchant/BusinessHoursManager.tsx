'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusinessHours } from '@/actions/business-hours-actions'

type DayRow = { weekday: number; closed: boolean; opensAt: string; closesAt: string }

const DAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function buildInitialRows(existing: { weekday: number; opensAt: string | null; closesAt: string | null; closed: boolean }[]): DayRow[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const found = existing.find((row) => row.weekday === weekday)
    return {
      weekday,
      closed: found?.closed ?? false,
      opensAt: found?.opensAt ?? '',
      closesAt: found?.closesAt ?? '',
    }
  })
}

export function BusinessHoursManager({
  hours,
}: {
  hours: { weekday: number; opensAt: string | null; closesAt: string | null; closed: boolean }[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<DayRow[]>(buildInitialRows(hours))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function update(weekday: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)))
    setSuccess(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const result = await updateBusinessHours(rows)
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
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-bold text-neutral-900">Horário de atendimento</h2>
        <p className="text-xs text-neutral-500">
          Fora desse horário o app não aceita novos pedidos com entrega. Se um dia ficar sem horário nenhum
          preenchido, esse dia conta como fechado.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.weekday} className="flex flex-wrap items-center gap-3 border-b border-neutral-100 pb-2 last:border-0">
            <span className="w-24 text-sm font-medium text-neutral-700">{DAY_LABELS[row.weekday]}</span>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
              <input
                type="checkbox"
                checked={row.closed}
                onChange={(e) => update(row.weekday, { closed: e.target.checked })}
              />
              Fechado
            </label>
            {!row.closed && (
              <>
                <input
                  type="time"
                  value={row.opensAt}
                  onChange={(e) => update(row.weekday, { opensAt: e.target.value })}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-neutral-400">até</span>
                <input
                  type="time"
                  value={row.closesAt}
                  onChange={(e) => update(row.weekday, { closesAt: e.target.value })}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Horários salvos.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Salvar horários'}
      </button>
    </div>
  )
}
