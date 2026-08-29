import { CopyableLink } from '@/components/admin/CopyableLink'

const BASE_URL = 'https://akiofertas.com.br'

export default function AdminLinksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Links úteis</h1>
        <p className="text-sm text-neutral-500">Endereços do site, dos painéis e das integrações, prontos pra copiar.</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">Site</h2>
        <div className="flex flex-col gap-2">
          <CopyableLink label="Home pública" url={BASE_URL} />
          <CopyableLink label="Cadastro de comerciante" url={`${BASE_URL}/comerciante/cadastro`} />
          <CopyableLink label="Entrar / Login" url={`${BASE_URL}/entrar`} />
          <CopyableLink label="App mobile — versão web" url={`${BASE_URL}/app`} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">Painéis</h2>
        <div className="flex flex-col gap-2">
          <CopyableLink label="Painel Admin" url={`${BASE_URL}/admin`} />
          <CopyableLink label="Painel Comerciante" url={`${BASE_URL}/comerciante`} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">Integrações / API</h2>
        <div className="flex flex-col gap-2">
          <CopyableLink
            label="Webhook Asaas"
            description="Cola em Asaas → Integrações → Webhooks. Só aceita POST, não abre no navegador."
            url={`${BASE_URL}/api/webhooks/asaas`}
            navigable={false}
          />
          <CopyableLink
            label="Cron de expiração de trial"
            description="Chamado automaticamente pela Vercel todo dia. Exige token, não abre no navegador."
            url={`${BASE_URL}/api/cron/expire-trials`}
            navigable={false}
          />
          <CopyableLink label="Painel Asaas" description="Onde você configura cobrança e assinaturas." url="https://www.asaas.com" />
          <CopyableLink label="Painel Vercel" description="Deploy, variáveis de ambiente, domínios." url="https://vercel.com" />
        </div>
      </div>
    </div>
  )
}
