'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUpMerchant } from '@/actions/merchant-actions'

type Values = {
  ownerName: string
  email: string
  password: string
  businessName: string
  categoryId: string
  whatsapp: string
  address: string
  city: string
  state: string
  lat: string
  lng: string
}

export function MerchantSignupForm({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Values>({
    ownerName: '',
    email: '',
    password: '',
    businessName: '',
    categoryId: categories[0]?.id ?? '',
    whatsapp: '',
    address: '',
    city: '',
    state: '',
    lat: '',
    lng: '',
  })

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const lat = Number(values.lat)
    const lng = Number(values.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Informe latitude e longitude válidas.')
      return
    }

    setSaving(true)
    const result = await signUpMerchant({ ...values, lat, lng })
    setSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    router.push('/entrar?cadastro=sucesso')
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Sua conta</p>
      <input placeholder="Seu nome" value={values.ownerName} onChange={(e) => update('ownerName', e.target.value)} className={inputClass} required />
      <input type="email" placeholder="E-mail" value={values.email} onChange={(e) => update('email', e.target.value)} className={inputClass} required />
      <input type="password" placeholder="Senha" value={values.password} onChange={(e) => update('password', e.target.value)} className={inputClass} required />

      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Sua empresa</p>
      <input placeholder="Nome da empresa" value={values.businessName} onChange={(e) => update('businessName', e.target.value)} className={inputClass} required />
      <select value={values.categoryId} onChange={(e) => update('categoryId', e.target.value)} className={inputClass}>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <input placeholder="WhatsApp (com DDD)" value={values.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} className={inputClass} required />
      <input placeholder="Endereço" value={values.address} onChange={(e) => update('address', e.target.value)} className={inputClass} required />
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Cidade" value={values.city} onChange={(e) => update('city', e.target.value)} className={inputClass} required />
        <input placeholder="UF" maxLength={2} value={values.state} onChange={(e) => update('state', e.target.value)} className={inputClass} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Latitude" value={values.lat} onChange={(e) => update('lat', e.target.value)} className={inputClass} required />
        <input placeholder="Longitude" value={values.lng} onChange={(e) => update('lng', e.target.value)} className={inputClass} required />
      </div>
      <p className="text-xs text-neutral-400">
        Dica: clique com o botão direito no Google Maps sobre o endereço da sua empresa para copiar as coordenadas.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Cadastrando...' : 'Cadastrar empresa'}
      </button>
    </form>
  )
}
