'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleUserBlocked } from '@/actions/admin-actions'

export function UserBlockToggle({ userId, blocked }: { userId: string; blocked: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const result = await toggleUserBlocked(userId, !blocked)
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
        onClick={handleClick}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
          blocked ? 'bg-brand-green text-white' : 'border border-neutral-200 text-red-600'
        }`}
      >
        {pending ? 'Aguarde...' : blocked ? 'Desbloquear' : 'Bloquear'}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
