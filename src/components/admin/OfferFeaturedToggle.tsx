'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleOfferFeatured } from '@/actions/admin-actions'

export function OfferFeaturedToggle({ offerId, featured }: { offerId: string; featured: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setPending(true)
    setError(null)
    try {
      const result = await toggleOfferFeatured(offerId, !featured)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
          featured
            ? 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            : 'bg-brand-green text-white'
        }`}
      >
        {featured ? 'Remover do destaque' : 'Colocar em destaque'}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
