'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMenuItem, updateMenuItem, deleteMenuItem } from '@/actions/menu-actions'
import { centsToReais } from '@/lib/money'
import { ImageUploadField } from './ImageUploadField'

type MenuItem = { id: string; name: string; description: string | null; price: number | null; imageUrl: string | null }
type Values = { name: string; description: string; price: string; imageUrl: string }
const EMPTY: Values = { name: '', description: '', price: '', imageUrl: '' }

export function MenuManager({ items }: { items: MenuItem[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<Values>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id)
    setError(null)
    setValues({
      name: item.name,
      description: item.description ?? '',
      price: item.price !== null ? centsToReais(item.price) : '',
      imageUrl: item.imageUrl ?? '',
    })
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
      const result = editingId ? await updateMenuItem(editingId, values) : await createMenuItem(values)
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
    if (!window.confirm('Remover este item do cardápio?')) return
    await deleteMenuItem(id)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Cardápio</h1>
        {!showForm && (
          <button
            type="button"
            onClick={startAdd}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            + Novo item
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Nome
            <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Descrição
            <textarea
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              className={inputClass}
              rows={2}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Preço (R$) — opcional
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.price}
              onChange={(e) => update('price', e.target.value)}
              className={inputClass}
            />
          </label>
          <ImageUploadField
            label="Imagem do item"
            hint="Recomendado: 600×600px (quadrada), até 3MB"
            value={values.imageUrl}
            onChange={(url) => update('imageUrl', url)}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar item'}
            </button>
            <button type="button" onClick={cancelForm} className="text-sm font-bold text-neutral-500">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Você ainda não adicionou nenhum item ao cardápio.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Preço</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{item.name}</p>
                    {item.description && <p className="text-xs text-neutral-500">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{item.price !== null ? `R$ ${centsToReais(item.price)}` : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => startEdit(item)} className="text-xs font-bold text-brand-green">
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDelete(item.id)} className="text-xs font-bold text-red-600">
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
