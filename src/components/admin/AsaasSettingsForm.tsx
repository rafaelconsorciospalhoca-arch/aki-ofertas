'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveAppSettings } from '@/actions/admin-actions'

type Values = {
  asaasMode: 'SANDBOX' | 'PRODUCTION'
  asaasSandboxApiKey: string
  asaasProductionApiKey: string
  asaasWebhookToken: string
}

export function AsaasSettingsForm({
  initialMode,
  hasSandboxKey,
  hasProductionKey,
  hasWebhookToken,
}: {
  initialMode: 'SANDBOX' | 'PRODUCTION'
  hasSandboxKey: boolean
  hasProductionKey: boolean
  hasWebhookToken: boolean
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>({
    asaasMode: initialMode,
    asaasSandboxApiKey: '',
    asaasProductionApiKey: '',
    asaasWebhookToken: '',
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
        asaasMode: values.asaasMode,
        ...(values.asaasSandboxApiKey ? { asaasSandboxApiKey: values.asaasSandboxApiKey } : {}),
        ...(values.asaasProductionApiKey ? { asaasProductionApiKey: values.asaasProductionApiKey } : {}),
        ...(values.asaasWebhookToken ? { asaasWebhookToken: values.asaasWebhookToken } : {}),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaved(true)
      setValues((prev) => ({ ...prev, asaasSandboxApiKey: '', asaasProductionApiKey: '', asaasWebhookToken: '' }))
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
        Modo ativo
        <select
          value={values.asaasMode}
          onChange={(e) => update('asaasMode', e.target.value as 'SANDBOX' | 'PRODUCTION')}
          className={inputClass}
        >
          <option value="SANDBOX">Sandbox (teste)</option>
          <option value="PRODUCTION">Produção</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Chave de API (sandbox)
        <input
          value={values.asaasSandboxApiKey}
          onChange={(e) => update('asaasSandboxApiKey', e.target.value)}
          className={inputClass}
          placeholder={hasSandboxKey ? 'Já configurada — digite pra substituir' : 'Nenhuma chave configurada ainda'}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Chave de API (produção)
        <input
          value={values.asaasProductionApiKey}
          onChange={(e) => update('asaasProductionApiKey', e.target.value)}
          className={inputClass}
          placeholder={hasProductionKey ? 'Já configurada — digite pra substituir' : 'Nenhuma chave configurada ainda'}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Token do webhook
        <input
          value={values.asaasWebhookToken}
          onChange={(e) => update('asaasWebhookToken', e.target.value)}
          className={inputClass}
          placeholder={hasWebhookToken ? 'Já configurado — digite pra substituir' : 'Nenhum token configurado ainda'}
        />
      </label>

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
