'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusiness } from '@/actions/merchant-actions'

type Values = {
  name: string
  categoryId: string
  description: string
  phone: string
  whatsapp: string
  email: string
  instagram: string
  website: string
  address: string
  number: string
  neighborhood: string
  city: string
  state: string
  zip: string
  logoUrl: string
  coverUrl: string
}

export function BusinessProfileForm({
  categories,
  initialValues,
}: {
  categories: { id: string; name: string }[]
  initialValues: Values
}) {
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

    const result = await updateBusiness(values)

    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess(true)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nome da empresa
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Categoria
        <select value={values.categoryId} onChange={(e) => update('categoryId', e.target.value)} className={inputClass}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Descrição
        <textarea
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          className={inputClass}
          rows={3}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Telefone
          <input value={values.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          WhatsApp
          <input value={values.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          E-mail
          <input type="email" value={values.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Instagram
          <input value={values.instagram} onChange={(e) => update('instagram', e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Site
        <input value={values.website} onChange={(e) => update('website', e.target.value)} className={inputClass} placeholder="https://..." />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Endereço
        <input value={values.address} onChange={(e) => update('address', e.target.value)} className={inputClass} required />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Número
          <input value={values.number} onChange={(e) => update('number', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Bairro
          <input value={values.neighborhood} onChange={(e) => update('neighborhood', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          CEP
          <input value={values.zip} onChange={(e) => update('zip', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Cidade
          <input value={values.city} onChange={(e) => update('city', e.target.value)} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          UF
          <input maxLength={2} value={values.state} onChange={(e) => update('state', e.target.value)} className={inputClass} required />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        URL do logo
        <input value={values.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} className={inputClass} placeholder="https://..." />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        URL da capa
        <input value={values.coverUrl} onChange={(e) => update('coverUrl', e.target.value)} className={inputClass} placeholder="https://..." />
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
