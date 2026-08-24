'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusinessStatus } from '@/actions/admin-actions'

export function BusinessStatusActions({ businessId, status }: { businessId: string; status: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function changeStatus(newStatus: 'ACTIVE' | 'SUSPENDED' | 'REJECTED') {
    setPending(true)
    setError(null)
    try {
      const result = await updateBusinessStatus(businessId, newStatus)
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
      <div className="flex gap-2">
        {status === 'PENDING' && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => changeStatus('ACTIVE')}
              className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Aprovar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => changeStatus('REJECTED')}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 disabled:opacity-50"
            >
              Reprovar
            </button>
          </>
        )}
        {status === 'ACTIVE' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus('SUSPENDED')}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
          >
            Suspender
          </button>
        )}
        {(status === 'SUSPENDED' || status === 'REJECTED') && (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus('ACTIVE')}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Reativar
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
