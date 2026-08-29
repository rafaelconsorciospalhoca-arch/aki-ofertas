'use client'

import { useState } from 'react'
import { updateMerchantAccount } from '@/actions/account-actions'

type Values = { name: string; email: string }

export function AccountForm({ initialValues }: { initialValues: Values }) {
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
      const result = await updateMerchantAccount(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(true)
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-bold text-neutral-900">Dados da conta</h2>
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
