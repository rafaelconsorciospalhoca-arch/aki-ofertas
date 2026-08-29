'use client'

import { useState } from 'react'
import { changeMerchantPassword } from '@/actions/account-actions'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

export function PasswordForm() {
  const [values, setValues] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function update(key: keyof typeof EMPTY, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (values.newPassword !== values.confirmPassword) {
      setError('A confirmação não bate com a nova senha.')
      return
    }

    setSaving(true)
    try {
      const result = await changeMerchantPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(true)
      setValues(EMPTY)
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-bold text-neutral-900">Trocar senha</h2>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Senha atual
        <input
          type="password"
          value={values.currentPassword}
          onChange={(e) => update('currentPassword', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nova senha
        <input
          type="password"
          value={values.newPassword}
          onChange={(e) => update('newPassword', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Confirmar nova senha
        <input
          type="password"
          value={values.confirmPassword}
          onChange={(e) => update('confirmPassword', e.target.value)}
          className={inputClass}
          required
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Senha alterada.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Trocar senha'}
      </button>
    </form>
  )
}
