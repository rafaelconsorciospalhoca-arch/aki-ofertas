'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserByAdmin } from '@/actions/admin-actions'

type Values = {
  name: string
  email: string
  role: 'CONSUMER' | 'ADMIN'
  password: string
  phone: string
  city: string
  state: string
}

const EMPTY: Values = { name: '', email: '', role: 'CONSUMER', password: '', phone: '', city: '', state: '' }

export function CreateUserForm() {
  const router = useRouter()
  const [values, setValues] = useState<Values>(EMPTY)
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
      const result = await createUserByAdmin({
        name: values.name,
        email: values.email,
        role: values.role,
        password: values.password || undefined,
        phone: values.phone || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/usuarios')
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
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
        Papel
        <select value={values.role} onChange={(e) => update('role', e.target.value as Values['role'])} className={inputClass}>
          <option value="CONSUMER">Consumidor</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Senha {values.role === 'CONSUMER' ? '(opcional — consumidor pode entrar por código no app)' : ''}
        <input
          type="password"
          value={values.password}
          onChange={(e) => update('password', e.target.value)}
          className={inputClass}
          placeholder={values.role === 'ADMIN' ? 'Obrigatório para administrador' : 'Mínimo 8 caracteres'}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Telefone (opcional)
        <input value={values.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Cidade (opcional)
          <input value={values.city} onChange={(e) => update('city', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          UF
          <input
            value={values.state}
            onChange={(e) => update('state', e.target.value)}
            className={inputClass}
            maxLength={2}
            autoCapitalize="characters"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Cadastrar usuário'}
      </button>
    </form>
  )
}
