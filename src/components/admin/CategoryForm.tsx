'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCategory, updateCategory } from '@/actions/admin-actions'

type Values = {
  name: string
  icon: string
  order: string
  active: boolean
  commissionPercent: string
}

export function CategoryForm({
  categoryId,
  initialValues,
}: {
  categoryId?: string
  initialValues?: Values
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(
    initialValues ?? { name: '', icon: '', order: '0', active: true, commissionPercent: '' },
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
      const result = categoryId ? await updateCategory(categoryId, values) : await createCategory(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/categorias')
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
        Ícone
        <input
          value={values.icon}
          onChange={(e) => update('icon', e.target.value)}
          className={inputClass}
          placeholder="utensils, coffee, scissors..."
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Ordem
        <input
          type="number"
          min="0"
          value={values.order}
          onChange={(e) => update('order', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.active} onChange={(e) => update('active', e.target.checked)} />
        Ativa
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Comissão de entrega (%) — deixe vazio se não cobrar
        <input
          type="number"
          min="0"
          max="100"
          value={values.commissionPercent}
          onChange={(e) => update('commissionPercent', e.target.value)}
          className={inputClass}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : categoryId ? 'Salvar alterações' : 'Criar categoria'}
      </button>
    </form>
  )
}
