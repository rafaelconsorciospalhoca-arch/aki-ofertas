'use client'

import { useState } from 'react'
import { validateCoupon } from '@/actions/coupon-actions'

type Result = { ok: true; offerTitle: string; customerName: string } | { ok: false; error: string } | null

export function ValidateCouponForm() {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Result>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setResult(null)
    try {
      const response = await validateCoupon(code.trim().toUpperCase())
      setResult(response)
      if (response.ok) setCode('')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código do cupom"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase tracking-widest"
          required
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? 'Validando...' : 'Validar'}
        </button>
      </form>

      {result && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            result.ok ? 'bg-brand-green/10 text-brand-green' : 'bg-red-50 text-red-600'
          }`}
        >
          {result.ok ? (
            <>
              <p className="font-bold">Cupom validado!</p>
              <p>
                {result.offerTitle} — {result.customerName}
              </p>
            </>
          ) : (
            result.error
          )}
        </div>
      )}
    </div>
  )
}
