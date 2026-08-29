'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOffer, updateOffer } from '@/actions/offer-actions'
import { ImageUploadField } from './ImageUploadField'

type Values = {
  title: string
  description: string
  imageUrl: string
  originalPrice: string
  discountPrice: string
  categoryId: string
  quantityAvailable: string
  startDate: string
  endDate: string
  deliveryEnabled: boolean
  customCouponCode: string
}

export function OfferForm({
  categories,
  offerId,
  initialValues,
}: {
  categories: { id: string; name: string }[]
  offerId?: string
  initialValues?: Values
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(
    initialValues ?? {
      title: '',
      description: '',
      imageUrl: '',
      originalPrice: '',
      discountPrice: '',
      categoryId: categories[0]?.id ?? '',
      quantityAvailable: '',
      startDate: '',
      endDate: '',
      deliveryEnabled: false,
      customCouponCode: '',
    },
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pricingMode, setPricingMode] = useState<'price' | 'percent'>('price')
  const [discountPercent, setDiscountPercent] = useState('')

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function computeDiscountPrice(originalPrice: string, percent: string) {
    const original = Number(originalPrice)
    const pct = Number(percent)
    if (original > 0 && pct >= 0 && pct <= 100) {
      update('discountPrice', (original * (1 - pct / 100)).toFixed(2))
    }
  }

  function handleOriginalPriceChange(value: string) {
    update('originalPrice', value)
    if (pricingMode === 'percent') {
      computeDiscountPrice(value, discountPercent)
    }
  }

  function handleDiscountPercentChange(value: string) {
    setDiscountPercent(value)
    computeDiscountPrice(values.originalPrice, value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const result = offerId ? await updateOffer(offerId, values) : await createOffer(values)

      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/comerciante/ofertas')
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Título
        <input value={values.title} onChange={(e) => update('title', e.target.value)} className={inputClass} required />
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

      <ImageUploadField
        label="Imagem da oferta"
        hint="Recomendado: 800×600px (paisagem), até 5MB"
        value={values.imageUrl}
        onChange={(url) => update('imageUrl', url)}
      />

      <div>
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setPricingMode('price')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              pricingMode === 'price' ? 'bg-brand-green text-white' : 'border border-neutral-300 text-neutral-600'
            }`}
          >
            Por preço
          </button>
          <button
            type="button"
            onClick={() => setPricingMode('percent')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              pricingMode === 'percent' ? 'bg-brand-green text-white' : 'border border-neutral-300 text-neutral-600'
            }`}
          >
            Por porcentagem
          </button>
        </div>

        {pricingMode === 'price' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Preço original (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.originalPrice}
                onChange={(e) => update('originalPrice', e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Preço promocional (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.discountPrice}
                onChange={(e) => update('discountPrice', e.target.value)}
                className={inputClass}
                required
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Preço original (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.originalPrice}
                onChange={(e) => handleOriginalPriceChange(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Desconto (%)
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => handleDiscountPercentChange(e.target.value)}
                className={inputClass}
                required
              />
            </label>
          </div>
        )}

        {pricingMode === 'percent' && values.discountPrice && (
          <p className="mt-1 text-xs text-neutral-500">Preço promocional calculado: R$ {values.discountPrice}</p>
        )}
      </div>

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
        Quantidade disponível (opcional)
        <input
          type="number"
          min="0"
          value={values.quantityAvailable}
          onChange={(e) => update('quantityAvailable', e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Início
          <input
            type="date"
            value={values.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Fim
          <input
            type="date"
            value={values.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            className={inputClass}
            required
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={values.deliveryEnabled}
          onChange={(e) => update('deliveryEnabled', e.target.checked)}
        />
        Aceita pedido com entrega (delivery)
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Código de cupom fixo (opcional)
        <input
          value={values.customCouponCode}
          onChange={(e) => update('customCouponCode', e.target.value)}
          className={inputClass}
          placeholder="Ex: LOJA10"
        />
        <span className="text-xs font-normal text-neutral-400">
          Se você já valida cupons em outro sistema, defina aqui o código que ele espera — todo cliente que
          resgatar esta oferta vai receber esse mesmo código, em vez de um gerado automaticamente.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : offerId ? 'Salvar alterações' : 'Publicar oferta'}
      </button>
    </form>
  )
}
