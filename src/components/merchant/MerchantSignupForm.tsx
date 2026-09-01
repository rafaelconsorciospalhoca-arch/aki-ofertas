'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUpMerchant } from '@/actions/merchant-actions'
import { lookupCep } from '@/lib/cep'

type Values = {
  ownerName: string
  email: string
  password: string
  businessName: string
  categoryId: string
  whatsapp: string
  address: string
  cityState: string
}

export function MerchantSignupForm({
  categories,
  cities,
  redirectTo = '/entrar?cadastro=sucesso',
}: {
  categories: { id: string; name: string }[]
  cities: { id: string; name: string; state: string }[]
  redirectTo?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [zip, setZip] = useState('')
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found'>('idle')
  const [values, setValues] = useState<Values>({
    ownerName: '',
    email: '',
    password: '',
    businessName: '',
    categoryId: categories[0]?.id ?? '',
    whatsapp: '',
    address: '',
    cityState: '',
  })

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCepBlur() {
    const digits = zip.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepStatus('loading')
    const result = await lookupCep(zip)
    if (!result) {
      setCepStatus('not-found')
      return
    }
    setCepStatus('idle')

    const matchedCity = cities.find(
      (city) => city.name.toLowerCase() === result.city.toLowerCase() && city.state === result.state,
    )

    setValues((prev) => ({
      ...prev,
      address: [result.street, result.neighborhood].filter(Boolean).join(', ') || prev.address,
      cityState: matchedCity ? `${matchedCity.name}|${matchedCity.state}` : prev.cityState,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const [city, state] = values.cityState.split('|')
    if (!city || !state) {
      setError('Escolha uma cidade.')
      return
    }

    setSaving(true)
    try {
      const result = await signUpMerchant({
        ownerName: values.ownerName,
        email: values.email,
        password: values.password,
        businessName: values.businessName,
        categoryId: values.categoryId,
        whatsapp: values.whatsapp,
        address: values.address,
        city,
        state,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      router.push(redirectTo)
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
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
      <div>
        <input
          placeholder="CEP"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          onBlur={handleCepBlur}
          className={inputClass + ' w-full'}
          maxLength={9}
        />
        {cepStatus === 'loading' && <p className="mt-1 text-xs text-neutral-400">Buscando endereço...</p>}
        {cepStatus === 'not-found' && <p className="mt-1 text-xs text-red-600">CEP não encontrado, preencha manualmente.</p>}
      </div>
      <input placeholder="Endereço" value={values.address} onChange={(e) => update('address', e.target.value)} className={inputClass} required />
      <select value={values.cityState} onChange={(e) => update('cityState', e.target.value)} className={inputClass} required>
        <option value="">Escolha sua cidade</option>
        {cities.map((city) => (
          <option key={city.id} value={`${city.name}|${city.state}`}>
            {city.name} - {city.state}
          </option>
        ))}
      </select>
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
