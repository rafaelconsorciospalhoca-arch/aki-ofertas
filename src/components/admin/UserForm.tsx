'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateUser } from '@/actions/admin-actions'

type Values = {
  name: string
  email: string
  phone: string
  city: string
  state: string
}

export function UserForm({ userId, initialValues }: { userId: string; initialValues: Values }) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(initialValues)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const result = await updateUser(userId, values)
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

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nome
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        E-mail
        <input
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Telefone
        <input value={values.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Cidade
          <input value={values.city} onChange={(e) => update('city', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          UF
          <input maxLength={2} value={values.state} onChange={(e) => update('state', e.target.value)} className={inputClass} />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Dados salvos.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  )
}
