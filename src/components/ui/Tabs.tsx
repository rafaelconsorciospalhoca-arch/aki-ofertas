'use client'

import { useState } from 'react'

export function Tabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`flex-shrink-0 border-b-2 px-3 py-2 text-sm font-bold ${
              active === tab.id
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} className={active === tab.id ? 'block' : 'hidden'}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
