'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusiness } from '@/actions/merchant-actions'
import { lookupCep } from '@/lib/cep'
import { ImageUploadField } from './ImageUploadField'

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
  cityState: string
  zip: string
  logoUrl: string
  coverUrl: string
}

export function BusinessProfileForm({
  categories,
  cities,
  initialValues,
  initialServiceCityIds,
}: {
  categories: { id: string; name: string }[]
  cities: { id: string; name: string; state: string }[]
  initialValues: Values
  initialServiceCityIds: string[]
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(initialValues)
  const [serviceCityIds, setServiceCityIds] = useState<string[]>(initialServiceCityIds)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found'>('idle')

  function toggleServiceCity(cityId: string) {
    setServiceCityIds((prev) => (prev.includes(cityId) ? prev.filter((id) => id !== cityId) : [...prev, cityId]))
    setSuccess(false)
  }

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function handleCepBlur() {
    const digits = values.zip.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepStatus('loading')
    const result = await lookupCep(values.zip)
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
      address: result.street || prev.address,
      neighborhood: result.neighborhood || prev.neighborhood,
      cityState: matchedCity ? `${matchedCity.name}|${matchedCity.state}` : prev.cityState,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const [city, state] = values.cityState.split('|')
    if (!city || !state) {
      setError('Escolha uma cidade.')
      return
    }

    setSaving(true)
    try {
      const result = await updateBusiness({
        name: values.name,
        categoryId: values.categoryId,
        description: values.description,
        phone: values.phone,
        whatsapp: values.whatsapp,
        email: values.email,
        instagram: values.instagram,
        website: values.website,
        address: values.address,
        number: values.number,
        neighborhood: values.neighborhood,
        city,
        state,
        zip: values.zip,
        logoUrl: values.logoUrl,
        coverUrl: values.coverUrl,
        serviceCityIds,
      })

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
        CEP
        <input
          value={values.zip}
          onChange={(e) => update('zip', e.target.value)}
          onBlur={handleCepBlur}
          className={inputClass}
          placeholder="00000-000"
          maxLength={9}
        />
        {cepStatus === 'loading' && <span className="text-xs font-normal text-neutral-400">Buscando endereço...</span>}
        {cepStatus === 'not-found' && (
          <span className="text-xs font-normal text-red-600">CEP não encontrado, preencha manualmente.</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Endereço
        <input value={values.address} onChange={(e) => update('address', e.target.value)} className={inputClass} required />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Número
          <input value={values.number} onChange={(e) => update('number', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Bairro
          <input value={values.neighborhood} onChange={(e) => update('neighborhood', e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Cidade
        <select value={values.cityState} onChange={(e) => update('cityState', e.target.value)} className={inputClass} required>
          <option value="">Escolha sua cidade</option>
          {cities.map((city) => (
            <option key={city.id} value={`${city.name}|${city.state}`}>
              {city.name} - {city.state}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Outras cidades atendidas (opcional)
        <p className="text-xs font-normal text-neutral-400">
          Suas ofertas também aparecem para clientes navegando nessas cidades.
        </p>
        <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-neutral-300 p-3">
          {cities.map((city) => (
            <label key={city.id} className="flex items-center gap-2 text-sm font-normal text-neutral-700">
              <input
                type="checkbox"
                checked={serviceCityIds.includes(city.id)}
                onChange={() => toggleServiceCity(city.id)}
              />
              {city.name} - {city.state}
            </label>
          ))}
        </div>
      </div>

      <ImageUploadField
        label="Logo da loja"
        hint="Recomendado: 400×400px (quadrada), até 2MB"
        value={values.logoUrl}
        onChange={(url) => update('logoUrl', url)}
      />

      <ImageUploadField
        label="Capa da loja"
        hint="Recomendado: 1200×400px (larga), até 5MB"
        value={values.coverUrl}
        onChange={(url) => update('coverUrl', url)}
      />

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
