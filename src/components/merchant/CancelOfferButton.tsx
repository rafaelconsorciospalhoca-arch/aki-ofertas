'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelOffer } from '@/actions/offer-actions'

export function CancelOfferButton({ offerId }: { offerId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    if (!window.confirm('Cancelar esta oferta? Ela deixará de aparecer para os consumidores.')) {
      return
    }
    setPending(true)
    try {
      await cancelOffer(offerId)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-bold text-red-600 disabled:opacity-50"
    >
      {pending ? 'Cancelando...' : 'Cancelar'}
    </button>
  )
}
