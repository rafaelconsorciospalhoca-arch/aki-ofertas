'use client'

import { useState } from 'react'
import { generateCoupon } from '@/actions/coupon-actions'

type InitialCoupon = { code: string } | null

export function GenerateCouponButton({
  offerId,
  initialCoupon,
  soldOut,
}: {
  offerId: string
  initialCoupon: InitialCoupon
  soldOut: boolean
}) {
  const [coupon, setCoupon] = useState<InitialCoupon>(initialCoupon)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const result = await generateCoupon(offerId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setCoupon({ code: result.coupon.code })
    } finally {
      setPending(false)
    }
  }

  if (coupon) {
    return (
      <div className="rounded-lg bg-brand-green/10 px-4 py-3 text-center">
        <p className="text-xs font-medium text-neutral-500">Seu código</p>
        <p className="text-2xl font-bold tracking-widest text-brand-green">{coupon.code}</p>
        <p className="mt-1 text-xs text-neutral-500">Mostre este código no estabelecimento</p>
      </div>
    )
  }

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-200 px-4 py-3 text-sm font-bold text-neutral-500"
      >
        Esgotado
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? 'Gerando...' : 'Gerar cupom'}
      </button>
    </div>
  )
}
