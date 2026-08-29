'use client'

import { useState } from 'react'

export function CopyableLink({
  label,
  description,
  url,
  navigable = true,
}: {
  label: string
  description?: string
  url: string
  navigable?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-neutral-900">{label}</p>
        {description && <p className="text-xs text-neutral-500">{description}</p>}
        {navigable ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-brand-green"
          >
            {url}
          </a>
        ) : (
          <p className="truncate text-xs text-neutral-400">{url}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="flex-shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-600"
      >
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}
