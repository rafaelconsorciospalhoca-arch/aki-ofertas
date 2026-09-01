'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  upsertDeliveryZone,
  deleteDeliveryZone,
  toggleDeliveryZoneActive,
  importDeliveryZones,
} from '@/actions/delivery-zone-actions'
import { centsToReais } from '@/lib/money'

type Zone = { id: string; neighborhood: string; feeCents: number; active: boolean }
type Values = { neighborhood: string; feeCents: string }
const EMPTY: Values = { neighborhood: '', feeCents: '' }

function parseZonesCsv(text: string): { neighborhood: string; feeCents: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const startIndex = /^bairro[,;]/i.test(lines[0]) ? 1 : 0
  const rows: { neighborhood: string; feeCents: string }[] = []

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(/[,;]/)
    if (parts.length < 2) continue
    const neighborhood = parts[0].trim().replace(/^"|"$/g, '')
    const feeCents = parts[1].trim().replace(/^"|"$/g, '')
    if (neighborhood) rows.push({ neighborhood, feeCents })
  }

  return rows
}

export function DeliveryZoneManager({ zones }: { zones: Zone[] }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<Values>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)

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

  function handleExport() {
    const header = 'bairro,taxa\n'
    const body = zones.map((zone) => `${zone.neighborhood},${centsToReais(zone.feeCents)}`).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bairros-entrega.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    setImportResult(null)
    fileInputRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const rows = parseZonesCsv(text)
      if (rows.length === 0) {
        setImportResult({ imported: 0, errors: ['Nenhuma linha válida encontrada no arquivo.'] })
        return
      }

      const result = await importDeliveryZones(rows)
      if (!result.ok) {
        setImportResult({ imported: 0, errors: [result.error] })
        return
      }
      setImportResult({ imported: result.imported, errors: result.errors })
      router.refresh()
    } catch {
      setImportResult({ imported: 0, errors: ['Não foi possível ler o arquivo.'] })
    } finally {
      setImporting(false)
    }
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
          <p className="mt-1 text-xs text-neutral-400">
            Importar CSV espera duas colunas: bairro e taxa (ex: &quot;Centro,5.90&quot;). Use &quot;Exportar
            CSV&quot; para baixar um modelo com o formato certo.
          </p>
        </div>
        {!showForm && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={handleImportClick}
              disabled={importing}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 disabled:opacity-60"
            >
              {importing ? 'Importando...' : 'Importar CSV'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={startAdd}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
            >
              + Novo bairro
            </button>
          </div>
        )}
      </div>

      {importResult && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-medium text-neutral-900">
            {importResult.imported} bairro{importResult.imported === 1 ? '' : 's'} importado
            {importResult.imported === 1 ? '' : 's'}.
          </p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-red-600">
              {importResult.errors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

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
