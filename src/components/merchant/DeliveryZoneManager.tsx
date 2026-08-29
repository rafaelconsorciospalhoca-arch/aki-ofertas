'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertDeliveryZone, deleteDeliveryZone, toggleDeliveryZoneActive } from '@/actions/delivery-zone-actions'
import { centsToReais } from '@/lib/money'

type Zone = { id: string; neighborhood: string; feeCents: number; active: boolean }
type Values = { neighborhood: string; feeCents: string }
const EMPTY: Values = { neighborhood: '', feeCents: '' }

export function DeliveryZoneManager({ zones }: { zones: Zone[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<Values>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(zone: Zone) {
    setEditingId(zone.id)
    setError(null)
    setValues({ neighborhood: zone.neighborhood, feeCents: centsToReais(zone.feeCents) })
    setShowForm(true)
  }

  function startAdd() {
    setEditingId(null)
    setError(null)
    setValues(EMPTY)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await upsertDeliveryZone({ id: editingId ?? undefined, ...values })
      if (!result.ok) {
        setError(result.error)
        return
      }
      cancelForm()
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remover este bairro da lista de entrega?')) return
    await deleteDeliveryZone(id)
    router.refresh()
  }

  async function handleToggle(id: string, active: boolean) {
    await toggleDeliveryZoneActive(id, active)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Entrega</h1>
          <p className="text-sm text-neutral-500">
            Cadastre os bairros que você atende e o valor da taxa de entrega de cada um. Sem nenhum
            bairro cadastrado, a opção de entrega fica indisponível para o cliente.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={startAdd}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            + Novo bairro
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Bairro
            <input
              value={values.neighborhood}
              onChange={(e) => update('neighborhood', e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Taxa de entrega (R$)
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.feeCents}
              onChange={(e) => update('feeCents', e.target.value)}
              className={inputClass}
              required
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar bairro'}
            </button>
            <button type="button" onClick={cancelForm} className="text-sm font-bold text-neutral-500">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {zones.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum bairro cadastrado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Bairro</th>
                <th className="px-4 py-2">Taxa</th>
                <th className="px-4 py-2">Ativo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{zone.neighborhood}</td>
                  <td className="px-4 py-3 text-neutral-600">R$ {centsToReais(zone.feeCents)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={zone.active}
                      onChange={(e) => handleToggle(zone.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => startEdit(zone)} className="text-xs font-bold text-brand-green">
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDelete(zone.id)} className="text-xs font-bold text-red-600">
                        Remover
                      </button>
                    </div>
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
