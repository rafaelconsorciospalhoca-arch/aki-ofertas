import { getAppSettings } from '@/lib/app-settings'
import { AsaasSettingsForm } from '@/components/admin/AsaasSettingsForm'
import { AppLinksSettingsForm } from '@/components/admin/AppLinksSettingsForm'

export default async function AdminConfiguracoesPage() {
  const settings = await getAppSettings()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Configurações</h1>
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase text-neutral-500">Asaas</h2>
        <AsaasSettingsForm
          initialMode={(settings?.asaasMode as 'SANDBOX' | 'PRODUCTION') ?? 'SANDBOX'}
          hasSandboxKey={Boolean(settings?.asaasSandboxApiKey)}
          hasProductionKey={Boolean(settings?.asaasProductionApiKey)}
          hasWebhookToken={Boolean(settings?.asaasWebhookToken)}
        />
      </div>
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase text-neutral-500">Links das lojas de app</h2>
        <AppLinksSettingsForm
          initialAppStoreUrl={settings?.appStoreUrl ?? ''}
          initialPlayStoreUrl={settings?.playStoreUrl ?? ''}
        />
      </div>
    </div>
  )
}
