# Cobrança de Planos via Asaas + Trial de 3 Dias — Design

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:writing-plans to turn this into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Deixar o comerciante assinar um plano pago (Básico R$49,90 / Destaque R$99,90 / Turbo R$199,90) via Asaas, com um trial de 3 dias a partir da aprovação da loja — findo o trial sem assinatura ativa, o painel do comerciante fica bloqueado e as ofertas somem da busca, até ele assinar.

**Architecture:** Credenciais do Asaas ficam num registro único `AppSettings`, editável só pelo admin. O comerciante assina pela tela `/comerciante/plano`, que cria um Customer + Subscription no Asaas e redireciona pro link de pagamento hospedado por eles (boleto/cartão/pix). Um webhook (`/api/webhooks/asaas`) recebe a confirmação de pagamento e ativa o plano. Um cron diário expira trials vencidos. O bloqueio de acesso reaproveita o `BusinessStatus.SUSPENDED` que já existe e já é respeitado por toda consulta de oferta/loja no código atual — suspender uma loja já a esconde de tudo, sem tocar em nenhuma query existente.

**Tech Stack:** Next.js 14 (Route Handlers para webhook/cron), Prisma, Asaas REST API v3 (`https://api-sandbox.asaas.com/v3` em sandbox, `https://api.asaas.com/v3` em produção), Vercel Cron.

## Global Constraints

- Nenhum dado de cartão passa pelo nosso servidor — o comerciante sempre é redirecionado pro `invoiceUrl` hospedado pelo Asaas (checkout deles).
- `suspendedReason: 'ADMIN'` nunca é revertido automaticamente por pagamento — só um admin reativa manualmente uma loja banida por ele. Só `TRIAL_EXPIRED` e `PAYMENT_OVERDUE` são revertidos pelo webhook quando o pagamento é confirmado.
- Credenciais do Asaas (API keys, token de webhook) só existem no registro `AppSettings`, nunca em variável de ambiente hardcoded no código — o admin cola a chave pela UI depois de criar a conta.
- O modo ativo (`SANDBOX`/`PRODUCTION`) é um campo do `AppSettings`, lido em toda chamada à API do Asaas — nunca infira o modo a partir de `NODE_ENV`.
- Todo texto voltado ao comerciante em português, no mesmo tom direto do resto do produto.

---

## 1. Schema (`prisma/schema.prisma`)

```prisma
model AppSettings {
  id                    String   @id @default(cuid())
  asaasMode             String   @default("SANDBOX") // "SANDBOX" | "PRODUCTION"
  asaasSandboxApiKey    String?
  asaasProductionApiKey String?
  asaasWebhookToken     String?
  updatedAt             DateTime @updatedAt

  @@map("app_settings")
}
```

`Business` ganha três campos:

```prisma
  trialEndsAt     DateTime?
  asaasCustomerId String?
  suspendedReason String? // "ADMIN" | "TRIAL_EXPIRED" | "PAYMENT_OVERDUE"
```

`Subscription` (já existe) ganha um campo:

```prisma
  asaasSubscriptionId String?
```

Migration via `npx prisma migrate dev --name asaas_billing`.

## 2. `AppSettings` — leitura/gravação (`src/lib/app-settings.ts`)

```typescript
export async function getAppSettings(): Promise<AppSettings | null> {
  return prisma.appSettings.findFirst()
}

export async function upsertAppSettings(input: {
  asaasMode: 'SANDBOX' | 'PRODUCTION'
  asaasSandboxApiKey?: string
  asaasProductionApiKey?: string
  asaasWebhookToken?: string
}): Promise<void> {
  const existing = await prisma.appSettings.findFirst()
  if (existing) {
    await prisma.appSettings.update({ where: { id: existing.id }, data: input })
  } else {
    await prisma.appSettings.create({ data: input })
  }
}
```

Singleton garantido por convenção (só essas duas funções tocam a tabela, sempre por `findFirst`).

## 3. Tela admin `/admin/configuracoes`

Formulário simples (mesmo padrão de `src/app/admin/categorias`): campo select `Modo` (Sandbox / Produção), campo texto `Chave de API (sandbox)`, campo texto `Chave de API (produção)`, campo texto `Token do webhook`. Server action `saveAppSettings` chama `upsertAppSettings`. Ao carregar, mostra as chaves mascaradas (ex: `sk_live_••••••1234`, últimos 4 caracteres visíveis) — nunca renderiza a chave completa de volta pro navegador depois de salva.

## 4. Cliente Asaas (`src/lib/asaas.ts`)

```typescript
const BASE_URL = { SANDBOX: 'https://api-sandbox.asaas.com/v3', PRODUCTION: 'https://api.asaas.com/v3' } as const

async function asaasFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const settings = await getAppSettings()
  if (!settings) throw new Error('Asaas não configurado.')
  const apiKey = settings.asaasMode === 'PRODUCTION' ? settings.asaasProductionApiKey : settings.asaasSandboxApiKey
  if (!apiKey) throw new Error('Chave de API do Asaas não configurada para o modo atual.')

  const res = await fetch(`${BASE_URL[settings.asaasMode as 'SANDBOX' | 'PRODUCTION']}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', access_token: apiKey, ...init.headers },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Asaas ${path} falhou: ${JSON.stringify(body)}`)
  return body
}

export async function createAsaasCustomer(input: {
  name: string
  cpfCnpj: string
  email: string
  mobilePhone: string
  externalReference: string
}): Promise<string> {
  const body = await asaasFetch('/customers', { method: 'POST', body: JSON.stringify(input) })
  return body.id as string
}

export async function createAsaasSubscription(input: {
  customerId: string
  value: number
  description: string
  externalReference: string
}): Promise<{ subscriptionId: string; invoiceUrl: string }> {
  const subscription = await asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: 'UNDEFINED', // deixa o comerciante escolher boleto/cartão/pix na tela do Asaas
      value: input.value,
      cycle: 'MONTHLY',
      nextDueDate: new Date().toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.externalReference,
    }),
  })
  const payments = (await asaasFetch(`/subscriptions/${subscription.id}/payments`, { method: 'GET' })) as {
    data: { invoiceUrl: string }[]
  }
  const invoiceUrl = payments.data[0]?.invoiceUrl
  if (!invoiceUrl) throw new Error('Assinatura criada, mas sem link de pagamento.')
  return { subscriptionId: subscription.id as string, invoiceUrl }
}
```

`value` em reais (não centavos — a API do Asaas usa valor decimal, diferente do `priceCents` do nosso `Plan`; a função que chama `createAsaasSubscription` converte `priceCents / 100`).

## 5. Planos pagos como dado (não mais hardcoded na landing)

Os 3 planos pagos passam a viver na tabela `Plan` (que já existe, hoje só com `Grátis`/`Pro`/`Destaque` do seed antigo — atualizamos o seed pra refletir os nomes/preços reais definidos):

```typescript
// prisma/seed.ts — substitui as entradas Pro/Destaque existentes
{ name: 'Básico', priceCents: 4990, maxOffersPerMonth: 5, hasFlashOffers: false, hasFullMetrics: false },
{ name: 'Destaque', priceCents: 9990, maxOffersPerMonth: 15, hasFlashOffers: true, hasFullMetrics: false },
{ name: 'Turbo', priceCents: 19990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
```

(`hasFlashOffers`/`hasFullMetrics` continuam sem uso — ficam reservados pro projeto de enforcement, item 2, que decide o que cada flag realmente destrava. `maxOffersPerMonth` de "Destaque"/"Turbo" são valores razoáveis de partida; ajustáveis depois, não é o foco deste projeto.)

`getPaidPlans()` em `src/lib/plans.ts`: `prisma.plan.findMany({ where: { priceCents: { gt: 0 } }, orderBy: { priceCents: 'asc' } })`. A landing page (`PricingCards.tsx`) passa a receber esses planos como prop em vez de ter a lista hardcoded — mesma exibição visual de hoje, dado real por trás. Remove a etiqueta "Em breve" (a cobrança passa a existir de verdade).

## 6. Tela comerciante `/comerciante/plano`

Mostra:
- Se `business.status === 'ACTIVE'` e sem assinatura paga ativa: "Seu período de teste termina em X dias" (calculado de `trialEndsAt`).
- Se `business.status === 'SUSPENDED'` e `suspendedReason !== 'ADMIN'`: aviso de que o acesso está bloqueado até assinar.
- Se tem assinatura paga ativa: nome do plano atual + data de renovação (`Subscription.renewsAt`).
- Campo `CPF/CNPJ` (mapeia pra `Business.document`, hoje não coletado em nenhum lugar) — obrigatório preencher antes de poder assinar, já que a API do Asaas exige `cpfCnpj` pra criar o Customer.
- Os planos pagos (`getPaidPlans()`), cada um com botão "Assinar".

Server action `subscribeToPlan(planId)`:
1. Valida que `business.document` está preenchido (senão retorna erro pedindo pra preencher).
2. Se `business.asaasCustomerId` não existe, cria o Customer no Asaas (`name` = nome do dono, `cpfCnpj` = `business.document`, `email` = `business.email ?? owner.email`, `mobilePhone` = `business.whatsapp`, `externalReference` = `business.id`) e salva o id.
3. Cria a Subscription no Asaas (`value` = `plan.priceCents / 100`, `externalReference` = `business.id`).
4. Salva/atualiza a linha `Subscription` local (`status: 'PENDING'`, `asaasSubscriptionId`).
5. Retorna a `invoiceUrl` — a página faz `redirect()` pra lá.

## 7. Webhook `/api/webhooks/asaas/route.ts`

```typescript
export async function POST(req: Request) {
  const settings = await getAppSettings()
  const token = req.headers.get('asaas-access-token')
  if (!settings?.asaasWebhookToken || token !== settings.asaasWebhookToken) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const event = body.event as string
  const subscriptionId = body.payment?.subscription as string | undefined

  if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event) && subscriptionId) {
    await activateSubscription(subscriptionId)
  } else if (['PAYMENT_OVERDUE', 'SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(event)) {
    const id = subscriptionId ?? (body.subscription?.id as string | undefined)
    if (id) await suspendForPayment(id)
  }

  return new Response('OK', { status: 200 })
}
```

`activateSubscription`/`suspendForPayment` em `src/lib/billing.ts`: buscam a `Subscription` local por `asaasSubscriptionId`, e:
- **ativar:** `Subscription.status = 'ACTIVE'`, `Business.planId = subscription.planId`, `Business.status = 'ACTIVE'`, `Business.suspendedReason = null` (só se o motivo atual não era `'ADMIN'`).
- **suspender:** `Subscription.status = 'INACTIVE'`, `Business.status = 'SUSPENDED'`, `Business.suspendedReason = 'PAYMENT_OVERDUE'` (não mexe se já estava suspensa por `'ADMIN'`).

O nome exato do campo que carrega o id da assinatura dentro do payload de `payment` (`body.payment.subscription`) e dentro do payload de eventos de `SUBSCRIPTION_*` (`body.subscription.id`) deve ser confirmado contra uma notificação real de sandbox antes de finalizar — a doc pública descreve o formato geral mas o campo exato varia por tipo de evento; a implementação deve logar o payload cru nas primeiras execuções em sandbox pra confirmar antes de remover o log.

## 8. Cron diário `/api/cron/expire-trials/route.ts`

```typescript
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const expired = await prisma.business.findMany({
    where: { status: 'ACTIVE', trialEndsAt: { lt: new Date() } },
    include: { subscriptions: { where: { status: 'ACTIVE' } } },
  })
  const toSuspend = expired.filter((b) => b.subscriptions.length === 0)
  await prisma.business.updateMany({
    where: { id: { in: toSuspend.map((b) => b.id) } },
    data: { status: 'SUSPENDED', suspendedReason: 'TRIAL_EXPIRED' },
  })

  return Response.json({ suspended: toSuspend.length })
}
```

`vercel.json` ganha:

```json
{ "crons": [{ "path": "/api/cron/expire-trials", "schedule": "0 6 * * *" }] }
```

`CRON_SECRET` é uma variável de ambiente normal do Vercel (não vai no `AppSettings` — não é credencial do Asaas, é só o segredo que autentica o próprio cron da Vercel).

## 9. Papel do plano Grátis existente

O cadastro (`src/actions/merchant-actions.ts`) continua atribuindo o plano `Grátis` a toda loja nova, sem nenhuma mudança — isso não muda. A suspensão por trial vencido é decidida só por `trialEndsAt` + existência de uma `Subscription` com `status: 'ACTIVE'` apontando pra um plano pago, nunca pelo `Business.planId` em si. Ou seja: uma loja pode continuar "no plano Grátis" nominalmente e ainda assim ser suspensa se o trial venceu sem ela ter assinado um dos 3 planos pagos — o `Grátis` deixa de ser, na prática, um plano que mantém acesso por si só.

## 10. `trialEndsAt` na aprovação do admin

`src/actions/admin-actions.ts`, na função que muda `Business.status`: quando a transição é `PENDING → ACTIVE`, seta `trialEndsAt = agora + 3 dias` (só nessa transição específica — mudar de `SUSPENDED` pra `ACTIVE` manualmente, por exemplo, não deve resetar o trial).

## 11. Bloqueio do painel do comerciante

`src/app/comerciante/layout.tsx` já existe (hoje só monta `DashboardShell`); vira um server component async que busca a `Business` da sessão via `getBusinessForOwner` (já existe em `src/lib/merchant.ts`). Bloqueia só quando `status === 'SUSPENDED'` — **não** quando `PENDING` (aguardando aprovação, sem trial ainda) ou `REJECTED` (fluxos que o dashboard já trata com um banner inline, sem tocar). Sem sessão, ou sessão sem `Business` ainda (ex: `/comerciante/cadastro`, acessado antes de existir conta), a página renderiza normal — o bloqueio só entra quando existe uma empresa de verdade e ela está suspensa. Quando bloqueado: tela com mensagem (texto muda conforme `suspendedReason` — `TRIAL_EXPIRED`/`PAYMENT_OVERDUE` mostram "assine um plano pra continuar" com botão pra `/comerciante/plano`; `ADMIN` mostra uma mensagem genérica de conta suspensa, sem esse botão) em vez de `children`.

`layout.tsx` (server) não tem acesso direto ao pathname — pra deixar `/comerciante/plano` sempre acessível mesmo suspenso, a checagem de rota fica num componente cliente `MerchantAccessGate` (`src/components/merchant/MerchantAccessGate.tsx`), que recebe `suspended`/`suspendedReason` como prop já calculados no servidor e usa `usePathname()` (mesmo padrão já usado em `ConsumerShell`) pra pular o bloqueio quando a rota atual for `/comerciante/plano`.

## Testes

- `src/lib/__tests__/app-settings.test.ts` — `getAppSettings`/`upsertAppSettings` (mock Prisma).
- `src/lib/__tests__/asaas.test.ts` — mocka `global.fetch`; testa `createAsaasCustomer` e `createAsaasSubscription` (URL correta por modo, erro quando falta API key, erro quando a resposta não é `ok`).
- `src/lib/__tests__/billing.test.ts` — `activateSubscription`/`suspendForPayment`: ativa plano correto, não reverte suspensão `ADMIN`, idempotente se chamado duas vezes pro mesmo evento.
- `src/app/api/webhooks/asaas/__tests__/route.test.ts` — 401 sem token/token errado; roteia evento pro handler certo.
- `src/app/api/cron/expire-trials/__tests__/route.test.ts` — 401 sem `CRON_SECRET`; suspende só quem tem trial vencido e sem assinatura ativa.
- `src/lib/__tests__/plans.test.ts` — `getPaidPlans` filtra `priceCents > 0`, ordenado.

## Erros e casos de borda

- Comerciante clica "Assinar" sem CPF/CNPJ preenchido → erro de validação amigável, não chama o Asaas.
- Falha de rede/API do Asaas ao criar Customer/Subscription → erro exibido na tela, nenhuma linha `Subscription` é criada (evita registro órfão sem `asaasSubscriptionId` válido).
- Webhook chega pra uma `Subscription` que não existe localmente (`asaasSubscriptionId` desconhecido) → responde 200 (evita retry infinito do Asaas) e loga um aviso, sem lançar erro.
- Cron roda mais de uma vez no mesmo dia (reexecução manual) → idempotente, só afeta quem ainda está `ACTIVE` com trial vencido.
