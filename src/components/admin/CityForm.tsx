'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCity, updateCity } from '@/actions/admin-actions'

type Values = {
  name: string
  state: string
  active: boolean
  comingSoon: boolean
}

export function CityForm({
  cityId,
  initialValues,
}: {
  cityId?: string
  initialValues?: Values
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(
    initialValues ?? { name: '', state: '', active: true, comingSoon: false },
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
      const result = cityId ? await updateCity(cityId, values) : await createCity(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/cidades')
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
        Cidade
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        UF
        <input
          maxLength={2}
          value={values.state}
          onChange={(e) => update('state', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.active} onChange={(e) => update('active', e.target.checked)} />
        Ativa
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.comingSoon} onChange={(e) => update('comingSoon', e.target.checked)} />
        Em breve
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : cityId ? 'Salvar alterações' : 'Criar cidade'}
      </button>
    </form>
  )
}
