'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveAppSettings } from '@/actions/admin-actions'

type Values = {
  appStoreUrl: string
  playStoreUrl: string
}

export function AppLinksSettingsForm({
  initialAppStoreUrl,
  initialPlayStoreUrl,
}: {
  initialAppStoreUrl: string
  initialPlayStoreUrl: string
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>({
    appStoreUrl: initialAppStoreUrl,
    playStoreUrl: initialPlayStoreUrl,
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await saveAppSettings({
        appStoreUrl: values.appStoreUrl.trim(),
        playStoreUrl: values.playStoreUrl.trim(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Link da Play Store (Android)
        <input
          value={values.playStoreUrl}
          onChange={(e) => update('playStoreUrl', e.target.value)}
          className={inputClass}
          placeholder="https://play.google.com/store/apps/details?id=..."
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Link da App Store (iOS)
        <input
          value={values.appStoreUrl}
          onChange={(e) => update('appStoreUrl', e.target.value)}
          className={inputClass}
          placeholder="https://apps.apple.com/app/id..."
        />
      </label>
      <p className="text-xs text-neutral-500">
        Deixe em branco pra esconder o botão correspondente na landing page (ex: enquanto o app ainda
        está em análise na loja).
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-green">Salvo.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
