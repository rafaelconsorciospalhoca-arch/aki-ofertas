'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAcceptedPaymentMethods } from '@/actions/delivery-zone-actions'
import type { PaymentMethod } from '@prisma/client'

const OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'Pix' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão de Débito' },
  { value: 'FOOD_VOUCHER', label: 'Cartão Alimentação' },
  { value: 'MEAL_VOUCHER', label: 'Cartão Refeição' },
  { value: 'CASH', label: 'Dinheiro' },
]

export function PaymentMethodsManager({ acceptedPaymentMethods }: { acceptedPaymentMethods: PaymentMethod[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<PaymentMethod[]>(acceptedPaymentMethods)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function toggle(method: PaymentMethod) {
    setSelected((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]))
    setSuccess(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const result = await updateAcceptedPaymentMethods(selected)
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-bold text-neutral-900">Formas de pagamento na entrega</h2>
        <p className="text-xs text-neutral-500">
          Escolha o que você aceita quando o cliente pede com entrega. Se nada estiver marcado, todas aparecem para o
          cliente por padrão.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
            {option.label}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Formas de pagamento salvas.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Salvar formas de pagamento'}
      </button>
    </div>
  )
}
