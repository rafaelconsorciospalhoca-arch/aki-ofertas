'use client'

import { useState } from 'react'

export function StoreTabs({
  about,
  ofertas,
}: {
  about: React.ReactNode
  ofertas: React.ReactNode
}) {
  const [tab, setTab] = useState<'sobre' | 'ofertas'>('ofertas')

  return (
    <div>
      <div className="flex gap-4 border-b border-neutral-200 px-4">
        <button
          type="button"
          onClick={() => setTab('sobre')}
          className={`border-b-2 py-2 text-sm font-bold ${
            tab === 'sobre' ? 'border-brand-green text-neutral-900' : 'border-transparent text-neutral-400'
          }`}
        >
          Sobre
        </button>
        <button
          type="button"
          onClick={() => setTab('ofertas')}
          className={`border-b-2 py-2 text-sm font-bold ${
            tab === 'ofertas' ? 'border-brand-green text-neutral-900' : 'border-transparent text-neutral-400'
          }`}
        >
          Ofertas
        </button>
      </div>
      <div className="p-4">{tab === 'sobre' ? about : ofertas}</div>
    </div>
  )
}
