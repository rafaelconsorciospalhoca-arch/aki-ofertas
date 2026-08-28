# Cobrança de Planos via Asaas + Trial de 3 Dias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comerciante assina um dos 3 planos pagos (Básico R$49,90 / Destaque R$99,90 / Turbo R$199,90) via Asaas; trial de 3 dias a partir da aprovação da loja; sem pagamento no fim do trial (ou em atraso depois), painel bloqueado e ofertas somem da busca até assinar.

**Architecture:** Credenciais do Asaas num registro único `AppSettings`, editável só pelo admin em `/admin/configuracoes`. Planos pagos viram dados reais na tabela `Plan`, editáveis em `/admin/planos`. Comerciante assina em `/comerciante/plano`, é redirecionado pro checkout hospedado do Asaas. Webhook confirma pagamento e ativa o plano. Cron diário expira trials vencidos. Bloqueio de acesso reaproveita `BusinessStatus.SUSPENDED`, já respeitado por toda consulta de oferta/loja existente.

**Tech Stack:** Next.js 14 (App Router, Route Handlers), Prisma, Asaas REST API v3, Vercel Cron, Vitest.

## Global Constraints

- Design de referência: `docs/superpowers/specs/2026-08-27-asaas-billing-design.md` — qualquer ambiguidade neste plano se resolve por aquele documento.
- Nenhum dado de cartão passa pelo nosso servidor — sempre redireciona pro `invoiceUrl` do Asaas.
- `suspendedReason: 'ADMIN'` nunca é revertido automaticamente por pagamento — só reativação manual do admin desfaz um banimento.
- Credenciais do Asaas só existem no registro `AppSettings` (colado pela UI admin), nunca hardcoded ou em variável de ambiente do app (exceção: `CRON_SECRET`, que autentica o cron da Vercel, não é credencial do Asaas).
- O modo ativo (`SANDBOX`/`PRODUCTION`) é um campo do `AppSettings`, nunca inferido de `NODE_ENV`.
- Bloqueio do painel do comerciante é só para `status === 'SUSPENDED'` — nunca para `PENDING` ou `REJECTED` (esses já têm tratamento próprio no dashboard existente, sem mudança).
- Todo texto voltado ao comerciante/admin em português, no tom direto já usado no resto do produto.
- Convenções a seguir (já estabelecidas no projeto): actions em `src/actions/*.ts` com `'use server'`, `requireAdmin()`/checagem de `session.user` no topo de cada função; libs de dados em `src/lib/*.ts` sem try/catch (erros propagam); testes Vitest mockando `@/lib/db` e `@/lib/auth` via `vi.mock`; Route Handlers com `NextResponse.json`; formulários admin seguindo o padrão de `CategoryForm.tsx` (client component, `useState`, chama a action, `router.push` + `router.refresh()`).

---

### Task 1: Schema — `AppSettings`, campos novos em `Business`/`Subscription`

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: gerada por `npx prisma migrate dev --name asaas_billing`

**Interfaces:**
- Produces: modelo `AppSettings` (`id`, `asaasMode`, `asaasSandboxApiKey`, `asaasProductionApiKey`, `asaasWebhookToken`, `updatedAt`); `Business.trialEndsAt: DateTime?`, `Business.asaasCustomerId: String?`, `Business.suspendedReason: String?`; `Subscription.asaasSubscriptionId: String?`.

- [ ] **Step 1: Adicionar o modelo `AppSettings` em `prisma/schema.prisma`**

Adicionar ao final do arquivo, antes do último `}` de fechamento do arquivo (ou em qualquer lugar no nível raiz — Prisma não exige ordem):

```prisma
model AppSettings {
  id                    String   @id @default(cuid())
  asaasMode             String   @default("SANDBOX")
  asaasSandboxApiKey    String?
  asaasProductionApiKey String?
  asaasWebhookToken     String?
  updatedAt             DateTime @updatedAt

  @@map("app_settings")
}
```

- [ ] **Step 2: Adicionar os campos novos em `Business`**

No `model Business { ... }`, logo abaixo do campo `planId`/`plan` existente, adicionar:

```prisma
  trialEndsAt     DateTime?
  asaasCustomerId String?
  suspendedReason String?
```

- [ ] **Step 3: Adicionar o campo novo em `Subscription`**

No `model Subscription { ... }`, logo abaixo de `renewsAt`, adicionar:

```prisma
  asaasSubscriptionId String?
```

- [ ] **Step 4: Gerar e aplicar a migration**

Run: `npx prisma migrate dev --name asaas_billing`
Expected: migration criada em `prisma/migrations/`, aplicada no banco local sem erro, `npx prisma generate` roda automaticamente ao final.

- [ ] **Step 5: Confirmar que o client gerado tipa os campos novos**

Run: `npx tsc --noEmit`
Expected: sem erros (o schema ainda não é referenciado em código TypeScript, então isso só confirma que a geração do Prisma Client não quebrou nada existente).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add AppSettings model and billing fields to Business/Subscription"
```

---

### Task 2: `src/lib/app-settings.ts` — leitura/gravação das credenciais

**Files:**
- Create: `src/lib/app-settings.ts`
- Test: `src/lib/__tests__/app-settings.test.ts`

**Interfaces:**
- Produces: `getAppSettings(): Promise<AppSettings | null>`, `upsertAppSettings(input: { asaasMode: 'SANDBOX' | 'PRODUCTION'; asaasSandboxApiKey?: string; asaasProductionApiKey?: string; asaasWebhookToken?: string }): Promise<void>` — consumidas pela action do Task 6 e pelo cliente Asaas do Task 3.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/lib/__tests__/app-settings.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAppSettings, upsertAppSettings } from '@/lib/app-settings'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    appSettings: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

describe('getAppSettings', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the single settings row', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({ id: 's1', asaasMode: 'SANDBOX' } as never)

    const result = await getAppSettings()

    expect(result).toEqual({ id: 's1', asaasMode: 'SANDBOX' })
  })

  it('returns null when nothing has been saved yet', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue(null)

    const result = await getAppSettings()

    expect(result).toBeNull()
  })
})

describe('upsertAppSettings', () => {
  afterEach(() => vi.clearAllMocks())

  it('creates the row when none exists', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue(null)

    await upsertAppSettings({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key-1' })

    expect(prisma.appSettings.create).toHaveBeenCalledWith({
      data: { asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key-1' },
    })
    expect(prisma.appSettings.update).not.toHaveBeenCalled()
  })

  it('updates the existing row instead of creating a second one', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({ id: 's1' } as never)

    await upsertAppSettings({ asaasMode: 'PRODUCTION', asaasProductionApiKey: 'key-2' })

    expect(prisma.appSettings.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { asaasMode: 'PRODUCTION', asaasProductionApiKey: 'key-2' },
    })
    expect(prisma.appSettings.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/app-settings.test.ts`
Expected: FAIL — `Cannot find module '@/lib/app-settings'`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/app-settings.ts
import { prisma } from '@/lib/db'
import type { AppSettings } from '@prisma/client'

export async function getAppSettings(): Promise<AppSettings | null> {
  return prisma.appSettings.findFirst()
}

export type UpsertAppSettingsInput = {
  asaasMode: 'SANDBOX' | 'PRODUCTION'
  asaasSandboxApiKey?: string
  asaasProductionApiKey?: string
  asaasWebhookToken?: string
}

export async function upsertAppSettings(input: UpsertAppSettingsInput): Promise<void> {
  const existing = await prisma.appSettings.findFirst()
  if (existing) {
    await prisma.appSettings.update({ where: { id: existing.id }, data: input })
  } else {
    await prisma.appSettings.create({ data: input })
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/app-settings.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/app-settings.ts src/lib/__tests__/app-settings.test.ts
git commit -m "feat: add AppSettings read/write helper"
```

---

### Task 3: `src/lib/asaas.ts` — cliente da API do Asaas

**Files:**
- Create: `src/lib/asaas.ts`
- Test: `src/lib/__tests__/asaas.test.ts`

**Interfaces:**
- Consumes: `getAppSettings()` do Task 2.
- Produces: `createAsaasCustomer(input): Promise<string>` (retorna o customer id), `createAsaasSubscription(input): Promise<{ subscriptionId: string; invoiceUrl: string }>` — consumidas pela action do Task 11.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/lib/__tests__/asaas.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas'
import { getAppSettings } from '@/lib/app-settings'

vi.mock('@/lib/app-settings', () => ({ getAppSettings: vi.fn() }))

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

describe('createAsaasCustomer', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('throws when Asaas has not been configured yet', async () => {
    vi.mocked(getAppSettings).mockResolvedValue(null)

    await expect(
      createAsaasCustomer({ name: 'João', cpfCnpj: '123', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' }),
    ).rejects.toThrow('Asaas não configurado.')
  })

  it('throws when the API key for the active mode is missing', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: null } as never)

    await expect(
      createAsaasCustomer({ name: 'João', cpfCnpj: '123', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' }),
    ).rejects.toThrow('Chave de API do Asaas não configurada para o modo atual.')
  })

  it('calls the sandbox base URL with the sandbox key when mode is SANDBOX', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_123' }))
    vi.stubGlobal('fetch', fetchMock)

    const id = await createAsaasCustomer({
      name: 'João', cpfCnpj: '12345678900', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1',
    })

    expect(id).toBe('cus_123')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ access_token: 'sandbox-key' }),
      }),
    )
  })

  it('calls the production base URL with the production key when mode is PRODUCTION', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'PRODUCTION', asaasProductionApiKey: 'prod-key' } as never)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'cus_456' }))
    vi.stubGlobal('fetch', fetchMock)

    await createAsaasCustomer({ name: 'João', cpfCnpj: '123', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.asaas.com/v3/customers',
      expect.objectContaining({ headers: expect.objectContaining({ access_token: 'prod-key' }) }),
    )
  })

  it('throws with the response body when the Asaas API returns an error', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: [{ description: 'CPF inválido' }] }, false)))

    await expect(
      createAsaasCustomer({ name: 'João', cpfCnpj: 'x', email: 'a@b.com', mobilePhone: '5546999990000', externalReference: 'biz-1' }),
    ).rejects.toThrow(/CPF inválido/)
  })
})

describe('createAsaasSubscription', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates the subscription and returns the first payment invoice url', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'sub_123' }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ invoiceUrl: 'https://sandbox.asaas.com/i/abc' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createAsaasSubscription({
      customerId: 'cus_123', value: 49.9, description: 'Plano Básico', externalReference: 'biz-1',
    })

    expect(result).toEqual({ subscriptionId: 'sub_123', invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api-sandbox.asaas.com/v3/subscriptions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-sandbox.asaas.com/v3/subscriptions/sub_123/payments',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('throws when the subscription has no payment with an invoice url yet', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: 'sub_123' }))
        .mockResolvedValueOnce(jsonResponse({ data: [] })),
    )

    await expect(
      createAsaasSubscription({ customerId: 'cus_123', value: 49.9, description: 'Plano Básico', externalReference: 'biz-1' }),
    ).rejects.toThrow('Assinatura criada, mas sem link de pagamento.')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/__tests__/asaas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/asaas'`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/asaas.ts
import { getAppSettings } from '@/lib/app-settings'

const BASE_URL = {
  SANDBOX: 'https://api-sandbox.asaas.com/v3',
  PRODUCTION: 'https://api.asaas.com/v3',
} as const

async function asaasFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const settings = await getAppSettings()
  if (!settings) throw new Error('Asaas não configurado.')

  const mode = settings.asaasMode as 'SANDBOX' | 'PRODUCTION'
  const apiKey = mode === 'PRODUCTION' ? settings.asaasProductionApiKey : settings.asaasSandboxApiKey
  if (!apiKey) throw new Error('Chave de API do Asaas não configurada para o modo atual.')

  const res = await fetch(`${BASE_URL[mode]}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', access_token: apiKey, ...init.headers },
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(`Asaas ${path} falhou: ${JSON.stringify(body)}`)
  }
  return body
}

export type CreateAsaasCustomerInput = {
  name: string
  cpfCnpj: string
  email: string
  mobilePhone: string
  externalReference: string
}

export async function createAsaasCustomer(input: CreateAsaasCustomerInput): Promise<string> {
  const body = await asaasFetch('/customers', { method: 'POST', body: JSON.stringify(input) })
  return body.id as string
}

export type CreateAsaasSubscriptionInput = {
  customerId: string
  value: number
  description: string
  externalReference: string
}

export type CreateAsaasSubscriptionResult = { subscriptionId: string; invoiceUrl: string }

export async function createAsaasSubscription(
  input: CreateAsaasSubscriptionInput,
): Promise<CreateAsaasSubscriptionResult> {
  const subscription = await asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: 'UNDEFINED',
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
  if (!invoiceUrl) {
    throw new Error('Assinatura criada, mas sem link de pagamento.')
  }

  return { subscriptionId: subscription.id as string, invoiceUrl }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/__tests__/asaas.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/asaas.ts src/lib/__tests__/asaas.test.ts
git commit -m "feat: add Asaas API client (customer + subscription creation)"
```

---

### Task 4: Planos pagos como dado real — `src/lib/plans.ts`, seed, CRUD admin

**Files:**
- Create: `src/lib/plans.ts`
- Test: `src/lib/__tests__/plans.test.ts`
- Modify: `prisma/seed.ts`
- Modify: `src/actions/admin-actions.ts`
- Test: `src/actions/__tests__/admin-actions.test.ts`
- Create: `src/components/admin/PlanForm.tsx`
- Create: `src/app/admin/planos/page.tsx`
- Create: `src/app/admin/planos/nova/page.tsx`
- Create: `src/app/admin/planos/[id]/page.tsx`
- Modify: `src/lib/admin.ts`

**Interfaces:**
- Produces: `getPaidPlans(): Promise<Plan[]>` (usada pelo Task 11 e pela landing no Task 13), `getAllPlans()`/`getPlanById(id)` em `src/lib/admin.ts` (padrão idêntico a `getAllCategories`/`getCategoryById`), `createPlan`/`updatePlan` em `src/actions/admin-actions.ts`.

O nav do `DashboardShell` já tem um link pra `/admin/planos` — hoje aponta pra uma rota inexistente (404). Esta task cria a tela de verdade, no mesmo padrão de `/admin/categorias`.

- [ ] **Step 1: Escrever o teste de `getPaidPlans`**

```typescript
// src/lib/__tests__/plans.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPaidPlans } from '@/lib/plans'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: { plan: { findMany: vi.fn() } },
}))

describe('getPaidPlans', () => {
  afterEach(() => vi.clearAllMocks())

  it('queries only plans with a price above zero, ordered by price', async () => {
    vi.mocked(prisma.plan.findMany).mockResolvedValue([
      { id: 'p1', name: 'Básico', priceCents: 4990, maxOffersPerMonth: 5 },
    ] as never)

    const result = await getPaidPlans()

    expect(prisma.plan.findMany).toHaveBeenCalledWith({
      where: { priceCents: { gt: 0 } },
      orderBy: { priceCents: 'asc' },
    })
    expect(result).toEqual([{ id: 'p1', name: 'Básico', priceCents: 4990, maxOffersPerMonth: 5 }])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/plans.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plans'`.

- [ ] **Step 3: Implementar `src/lib/plans.ts`**

```typescript
import { prisma } from '@/lib/db'

export async function getPaidPlans() {
  return prisma.plan.findMany({
    where: { priceCents: { gt: 0 } },
    orderBy: { priceCents: 'asc' },
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/plans.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar o seed com os 3 planos pagos reais**

Em `prisma/seed.ts`, substituir o array `planData`:

```typescript
  const planData = [
    { name: 'Grátis', priceCents: 0, maxOffersPerMonth: 3, hasFlashOffers: false, hasFullMetrics: false },
    { name: 'Básico', priceCents: 4990, maxOffersPerMonth: 5, hasFlashOffers: false, hasFullMetrics: false },
    { name: 'Destaque', priceCents: 9990, maxOffersPerMonth: 15, hasFlashOffers: true, hasFullMetrics: false },
    { name: 'Turbo', priceCents: 19990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
  ]
```

E, mais abaixo no mesmo arquivo, trocar a referência à loja de exemplo (que hoje usa o plano `'Pro'`, removido):

```typescript
      planId: plans['Básico'],
```

- [ ] **Step 6: Rodar o seed localmente e conferir**

Run: `npx prisma db seed`
Expected: sem erro; `Grátis`, `Básico`, `Destaque`, `Turbo` existem na tabela `plans` (upsert por `name` — não duplica se já existiam `Pro`/antigo `Destaque`, esses ficam órfãos na tabela mas sem referência ativa; não é necessário limpá-los agora).

- [ ] **Step 7: Adicionar `getAllPlans`/`getPlanById` em `src/lib/admin.ts`**

Ao final do arquivo, mesmo padrão de `getAllCategories`/`getCategoryById`:

```typescript
export async function getAllPlans() {
  return prisma.plan.findMany({ orderBy: { priceCents: 'asc' } })
}

export async function getPlanById(id: string) {
  return prisma.plan.findUnique({ where: { id } })
}
```

- [ ] **Step 8: Escrever os testes de `createPlan`/`updatePlan` em `src/actions/__tests__/admin-actions.test.ts`**

Adicionar ao mock `@/lib/db` do topo do arquivo: `plan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },`. Depois, ao final do arquivo:

```typescript
const validPlanInput = { name: 'Turbo', priceReais: '199.90', maxOffersPerMonth: '30', hasFlashOffers: true, hasFullMetrics: true }

describe('createPlan', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not an admin', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await createPlan(validPlanInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects a duplicate plan name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'p1' } as never)

    const result = await createPlan(validPlanInput)
    expect(result).toEqual({ ok: false, error: 'Este plano já existe.' })
  })

  it('creates the plan, converting reais to cents', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.create).mockResolvedValue({ id: 'p1' } as never)

    const result = await createPlan(validPlanInput)

    expect(result).toEqual({ ok: true, planId: 'p1' })
    expect(prisma.plan.create).toHaveBeenCalledWith({
      data: { name: 'Turbo', priceCents: 19990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
    })
  })
})

describe('updatePlan', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the plan does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null)

    const result = await updatePlan('p1', validPlanInput)
    expect(result).toEqual({ ok: false, error: 'Plano não encontrado.' })
  })

  it('updates the plan, converting reais to cents', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.plan.update).mockResolvedValue({ id: 'p1' } as never)

    const result = await updatePlan('p1', validPlanInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { name: 'Turbo', priceCents: 19990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
    })
  })
})
```

Adicionar `createPlan, updatePlan` ao import do topo do arquivo (junto de `updateBusinessStatus, createCategory, ...`).

- [ ] **Step 9: Rodar e ver falhar**

Run: `npx vitest run src/actions/__tests__/admin-actions.test.ts`
Expected: FAIL — `createPlan`/`updatePlan` não existem.

- [ ] **Step 10: Implementar `createPlan`/`updatePlan` em `src/actions/admin-actions.ts`**

Adicionar ao final do arquivo:

```typescript
const planSchema = z.object({
  name: z.string().min(2, 'Informe o nome do plano.'),
  priceReais: z.string().min(1, 'Informe o preço.'),
  maxOffersPerMonth: z.string().min(1, 'Informe o limite de ofertas.'),
  hasFlashOffers: z.boolean(),
  hasFullMetrics: z.boolean(),
})

type PlanInput = z.infer<typeof planSchema>
type PlanResult = { ok: true; planId: string } | { ok: false; error: string }

function parsePlanData(input: PlanInput): { priceCents: number; maxOffersPerMonth: number } | { error: string } {
  const priceCents = Math.round(Number(input.priceReais) * 100)
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return { error: 'Preço inválido.' }
  }
  const maxOffersPerMonth = Number(input.maxOffersPerMonth)
  if (!Number.isInteger(maxOffersPerMonth) || maxOffersPerMonth < 0) {
    return { error: 'Limite de ofertas inválido.' }
  }
  return { priceCents, maxOffersPerMonth }
}

export async function createPlan(input: PlanInput): Promise<PlanResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = planSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const data = parsePlanData(parsed.data)
  if ('error' in data) {
    return { ok: false, error: data.error }
  }

  const existing = await prisma.plan.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return { ok: false, error: 'Este plano já existe.' }
  }

  const plan = await prisma.plan.create({
    data: {
      name: parsed.data.name,
      priceCents: data.priceCents,
      maxOffersPerMonth: data.maxOffersPerMonth,
      hasFlashOffers: parsed.data.hasFlashOffers,
      hasFullMetrics: parsed.data.hasFullMetrics,
    },
  })

  return { ok: true, planId: plan.id }
}

export async function updatePlan(id: string, input: PlanInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = planSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const data = parsePlanData(parsed.data)
  if ('error' in data) {
    return { ok: false, error: data.error }
  }

  const existing = await prisma.plan.findUnique({ where: { id } })
  if (!existing) {
    return { ok: false, error: 'Plano não encontrado.' }
  }

  await prisma.plan.update({
    where: { id },
    data: {
      name: parsed.data.name,
      priceCents: data.priceCents,
      maxOffersPerMonth: data.maxOffersPerMonth,
      hasFlashOffers: parsed.data.hasFlashOffers,
      hasFullMetrics: parsed.data.hasFullMetrics,
    },
  })

  return { ok: true }
}
```

E adicionar `plan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },` ao mock de `@/lib/db` no topo do arquivo de teste, se ainda não estiver lá do Step 8.

- [ ] **Step 11: Rodar e ver passar**

Run: `npx vitest run src/actions/__tests__/admin-actions.test.ts`
Expected: PASS.

- [ ] **Step 12: Criar `PlanForm.tsx`**

```typescript
// src/components/admin/PlanForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPlan, updatePlan } from '@/actions/admin-actions'

type Values = {
  name: string
  priceReais: string
  maxOffersPerMonth: string
  hasFlashOffers: boolean
  hasFullMetrics: boolean
}

export function PlanForm({ planId, initialValues }: { planId?: string; initialValues?: Values }) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(
    initialValues ?? { name: '', priceReais: '', maxOffersPerMonth: '', hasFlashOffers: false, hasFullMetrics: false },
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = planId ? await updatePlan(planId, values) : await createPlan(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/planos')
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nome
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Preço mensal (R$)
        <input
          type="number"
          step="0.01"
          min="0"
          value={values.priceReais}
          onChange={(e) => update('priceReais', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Máximo de ofertas ativas
        <input
          type="number"
          min="0"
          value={values.maxOffersPerMonth}
          onChange={(e) => update('maxOffersPerMonth', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.hasFlashOffers} onChange={(e) => update('hasFlashOffers', e.target.checked)} />
        Ofertas relâmpago
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.hasFullMetrics} onChange={(e) => update('hasFullMetrics', e.target.checked)} />
        Métricas completas
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : planId ? 'Salvar alterações' : 'Criar plano'}
      </button>
    </form>
  )
}
```

- [ ] **Step 13: Criar as 3 páginas `/admin/planos`**

```typescript
// src/app/admin/planos/page.tsx
import Link from 'next/link'
import { getAllPlans } from '@/lib/admin'

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function AdminPlanosPage() {
  const plans = await getAllPlans()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Planos</h1>
        <Link href="/admin/planos/nova" className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white">
          + Novo plano
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Preço</th>
              <th className="px-4 py-2">Ofertas</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">{plan.name}</td>
                <td className="px-4 py-3 text-neutral-600">{formatPrice(plan.priceCents)}/mês</td>
                <td className="px-4 py-3 text-neutral-600">{plan.maxOffersPerMonth}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/planos/${plan.id}`} className="text-xs font-bold text-brand-green">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

```typescript
// src/app/admin/planos/nova/page.tsx
import { PlanForm } from '@/components/admin/PlanForm'

export default function NovoPlanoPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Novo plano</h1>
      <PlanForm />
    </div>
  )
}
```

```typescript
// src/app/admin/planos/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getPlanById } from '@/lib/admin'
import { PlanForm } from '@/components/admin/PlanForm'

export default async function EditarPlanoPage({ params }: { params: { id: string } }) {
  const plan = await getPlanById(params.id)
  if (!plan) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar plano</h1>
      <PlanForm
        planId={plan.id}
        initialValues={{
          name: plan.name,
          priceReais: (plan.priceCents / 100).toFixed(2),
          maxOffersPerMonth: String(plan.maxOffersPerMonth),
          hasFlashOffers: plan.hasFlashOffers,
          hasFullMetrics: plan.hasFullMetrics,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 14: Rodar typecheck e todos os testes do site**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 15: Commit**

```bash
git add src/lib/plans.ts src/lib/__tests__/plans.test.ts src/lib/admin.ts src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts src/components/admin/PlanForm.tsx src/app/admin/planos prisma/seed.ts
git commit -m "feat: real paid plans in the Plan table, with admin CRUD at /admin/planos"
```

---

### Task 5: Tela admin `/admin/configuracoes` — credenciais do Asaas

**Files:**
- Modify: `src/actions/admin-actions.ts`
- Modify: `src/actions/__tests__/admin-actions.test.ts`
- Create: `src/components/admin/AsaasSettingsForm.tsx`
- Create: `src/app/admin/configuracoes/page.tsx`
- Modify: `src/components/layout/DashboardShell.tsx`

**Interfaces:**
- Consumes: `getAppSettings`/`upsertAppSettings` do Task 2.
- Produces: `saveAppSettings` server action.

- [ ] **Step 1: Escrever o teste de `saveAppSettings`**

Adicionar `appSettings: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },` ao mock de `@/lib/db`, e ao final do arquivo de teste:

```typescript
describe('saveAppSettings', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not an admin', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await saveAppSettings({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('saves the settings when the caller is an admin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.appSettings.create).mockResolvedValue({ id: 's1' } as never)

    const result = await saveAppSettings({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key' })

    expect(result).toEqual({ ok: true })
    expect(prisma.appSettings.create).toHaveBeenCalledWith({
      data: { asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key' },
    })
  })
})
```

Adicionar `saveAppSettings` ao import do topo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/actions/__tests__/admin-actions.test.ts`
Expected: FAIL — `saveAppSettings` não existe.

- [ ] **Step 3: Implementar `saveAppSettings` em `src/actions/admin-actions.ts`**

```typescript
import { upsertAppSettings, type UpsertAppSettingsInput } from '@/lib/app-settings'

export async function saveAppSettings(input: UpsertAppSettingsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  await upsertAppSettings(input)
  return { ok: true }
}
```

(adicionar o `import` no topo do arquivo, junto dos demais).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/actions/__tests__/admin-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar `AsaasSettingsForm.tsx`**

As chaves nunca voltam completas pro navegador depois de salvas — o form recebe só um booleano "já configurada" por campo, e mostra um placeholder indicando isso; digitar um valor novo sempre substitui o que já existia (não há como "editar parcialmente" uma chave — só trocar inteira).

```typescript
// src/components/admin/AsaasSettingsForm.tsx
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
```

- [ ] **Step 6: Criar `/admin/configuracoes/page.tsx`**

```typescript
// src/app/admin/configuracoes/page.tsx
import { getAppSettings } from '@/lib/app-settings'
import { AsaasSettingsForm } from '@/components/admin/AsaasSettingsForm'

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
    </div>
  )
}
```

- [ ] **Step 7: Adicionar o link no nav do admin**

Em `src/components/layout/DashboardShell.tsx`, no array `admin`, logo abaixo de `{ href: '/admin/planos', label: 'Planos' }`:

```typescript
    { href: '/admin/configuracoes', label: 'Configurações' },
```

- [ ] **Step 8: Rodar typecheck e testes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros; todos os testes passam.

- [ ] **Step 9: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts src/components/admin/AsaasSettingsForm.tsx src/app/admin/configuracoes src/components/layout/DashboardShell.tsx
git commit -m "feat: admin screen to configure Asaas credentials"
```

---

### Task 6: `src/lib/billing.ts` — ativar/suspender por pagamento

**Files:**
- Create: `src/lib/billing.ts`
- Test: `src/lib/__tests__/billing.test.ts`

**Interfaces:**
- Produces: `activateSubscription(asaasSubscriptionId: string): Promise<void>`, `suspendForPayment(asaasSubscriptionId: string): Promise<void>` — consumidas pelo webhook do Task 7.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/lib/__tests__/billing.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { activateSubscription, suspendForPayment } from '@/lib/billing'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

describe('activateSubscription', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when no local subscription matches the Asaas id', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null)

    await activateSubscription('sub_unknown')

    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('activates the local subscription and the business plan', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: 'sub-local-1', businessId: 'biz-1', planId: 'plan-1',
    } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'TRIAL_EXPIRED' } as never)

    await activateSubscription('sub_123')

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-local-1' },
      data: { status: 'ACTIVE' },
    })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { planId: 'plan-1', status: 'ACTIVE', suspendedReason: null },
    })
  })

  it('never lifts an admin-imposed suspension', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: 'sub-local-1', businessId: 'biz-1', planId: 'plan-1',
    } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'ADMIN' } as never)

    await activateSubscription('sub_123')

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { planId: 'plan-1' },
    })
  })
})

describe('suspendForPayment', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when no local subscription matches the Asaas id', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null)

    await suspendForPayment('sub_unknown')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('suspends the business for payment when the subscription is found', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-local-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: null } as never)

    await suspendForPayment('sub_123')

    expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { id: 'sub-local-1' }, data: { status: 'INACTIVE' } })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'SUSPENDED', suspendedReason: 'PAYMENT_OVERDUE' },
    })
  })

  it('never overrides an admin-imposed suspension', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-local-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'ADMIN' } as never)

    await suspendForPayment('sub_123')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/billing.test.ts`
Expected: FAIL — `Cannot find module '@/lib/billing'`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/billing.ts
import { prisma } from '@/lib/db'

export async function activateSubscription(asaasSubscriptionId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({ where: { asaasSubscriptionId } })
  if (!subscription) return

  await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'ACTIVE' } })

  const business = await prisma.business.findUnique({ where: { id: subscription.businessId } })
  if (business?.suspendedReason === 'ADMIN') {
    await prisma.business.update({ where: { id: subscription.businessId }, data: { planId: subscription.planId } })
    return
  }

  await prisma.business.update({
    where: { id: subscription.businessId },
    data: { planId: subscription.planId, status: 'ACTIVE', suspendedReason: null },
  })
}

export async function suspendForPayment(asaasSubscriptionId: string): Promise<void> {
  const subscription = await prisma.subscription.findFirst({ where: { asaasSubscriptionId } })
  if (!subscription) return

  const business = await prisma.business.findUnique({ where: { id: subscription.businessId } })
  if (business?.suspendedReason === 'ADMIN') return

  await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'INACTIVE' } })
  await prisma.business.update({
    where: { id: subscription.businessId },
    data: { status: 'SUSPENDED', suspendedReason: 'PAYMENT_OVERDUE' },
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/billing.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing.ts src/lib/__tests__/billing.test.ts
git commit -m "feat: activate/suspend business plan from Asaas payment events"
```

---

### Task 7: Webhook `/api/webhooks/asaas`

**Files:**
- Create: `src/app/api/webhooks/asaas/route.ts`
- Test: `src/app/api/webhooks/asaas/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getAppSettings` (Task 2), `activateSubscription`/`suspendForPayment` (Task 6).

- [ ] **Step 1: Escrever o teste**

```typescript
// src/app/api/webhooks/asaas/__tests__/route.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/asaas/route'
import { getAppSettings } from '@/lib/app-settings'
import { activateSubscription, suspendForPayment } from '@/lib/billing'

vi.mock('@/lib/app-settings', () => ({ getAppSettings: vi.fn() }))
vi.mock('@/lib/billing', () => ({ activateSubscription: vi.fn(), suspendForPayment: vi.fn() }))

function request(body: unknown, token?: string) {
  return new Request('https://akiofertas.com.br/api/webhooks/asaas', {
    method: 'POST',
    headers: token ? { 'asaas-access-token': token } : {},
    body: JSON.stringify(body),
  })
}

describe('POST /api/webhooks/asaas', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when no webhook token is configured yet', async () => {
    vi.mocked(getAppSettings).mockResolvedValue(null)

    const response = await POST(request({ event: 'PAYMENT_CONFIRMED' }, 'anything'))
    expect(response.status).toBe(401)
  })

  it('rejects when the token header does not match', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    const response = await POST(request({ event: 'PAYMENT_CONFIRMED' }, 'wrong-token'))
    expect(response.status).toBe(401)
  })

  it('activates the subscription on PAYMENT_CONFIRMED', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    const response = await POST(
      request({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', subscription: 'sub_123' } }, 'correct-token'),
    )

    expect(response.status).toBe(200)
    expect(activateSubscription).toHaveBeenCalledWith('sub_123')
  })

  it('activates the subscription on PAYMENT_RECEIVED', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    await POST(request({ event: 'PAYMENT_RECEIVED', payment: { subscription: 'sub_123' } }, 'correct-token'))

    expect(activateSubscription).toHaveBeenCalledWith('sub_123')
  })

  it('suspends the business on PAYMENT_OVERDUE', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    await POST(request({ event: 'PAYMENT_OVERDUE', payment: { subscription: 'sub_123' } }, 'correct-token'))

    expect(suspendForPayment).toHaveBeenCalledWith('sub_123')
  })

  it('suspends the business on SUBSCRIPTION_DELETED, reading the subscription id from the subscription object', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    await POST(request({ event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_123' } }, 'correct-token'))

    expect(suspendForPayment).toHaveBeenCalledWith('sub_123')
  })

  it('ignores unrecognized events without erroring', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

    const response = await POST(request({ event: 'PAYMENT_CREATED' }, 'correct-token'))

    expect(response.status).toBe(200)
    expect(activateSubscription).not.toHaveBeenCalled()
    expect(suspendForPayment).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/api/webhooks/asaas/__tests__/route.test.ts`
Expected: FAIL — módulo da rota não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/app/api/webhooks/asaas/route.ts
import { NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/app-settings'
import { activateSubscription, suspendForPayment } from '@/lib/billing'

const ACTIVATE_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']
const SUSPEND_EVENTS = ['PAYMENT_OVERDUE', 'SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']

export async function POST(request: Request) {
  const settings = await getAppSettings()
  const token = request.headers.get('asaas-access-token')
  if (!settings?.asaasWebhookToken || token !== settings.asaasWebhookToken) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const event = body?.event as string | undefined
  const subscriptionId = (body?.payment?.subscription ?? body?.subscription?.id) as string | undefined

  if (event && subscriptionId) {
    if (ACTIVATE_EVENTS.includes(event)) {
      await activateSubscription(subscriptionId)
    } else if (SUSPEND_EVENTS.includes(event)) {
      await suspendForPayment(subscriptionId)
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/api/webhooks/asaas/__tests__/route.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/asaas
git commit -m "feat: Asaas webhook endpoint"
```

---

### Task 8: Cron diário `/api/cron/expire-trials`

**Files:**
- Create: `src/app/api/cron/expire-trials/route.ts`
- Test: `src/app/api/cron/expire-trials/__tests__/route.test.ts`
- Modify: `vercel.json` (criar se não existir)

**Interfaces:**
- Consumes: `prisma` diretamente (é uma consulta simples, não justifica uma lib nova).

- [ ] **Step 1: Escrever o teste**

```typescript
// src/app/api/cron/expire-trials/__tests__/route.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/cron/expire-trials/route'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}))

function request(authHeader?: string) {
  return new Request('https://akiofertas.com.br/api/cron/expire-trials', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/expire-trials', () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = originalSecret
  })

  it('rejects without the correct bearer token', async () => {
    process.env.CRON_SECRET = 'the-secret'

    const response = await GET(request('Bearer wrong'))
    expect(response.status).toBe(401)
  })

  it('suspends only ACTIVE businesses past their trial with no active subscription', async () => {
    process.env.CRON_SECRET = 'the-secret'
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { id: 'biz-1', subscriptions: [] },
      { id: 'biz-2', subscriptions: [{ id: 'sub-1' }] },
    ] as never)
    vi.mocked(prisma.business.updateMany).mockResolvedValue({ count: 1 } as never)

    const response = await GET(request('Bearer the-secret'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ suspended: 1 })
    expect(prisma.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', trialEndsAt: { lt: expect.any(Date) } } }),
    )
    expect(prisma.business.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['biz-1'] } },
      data: { status: 'SUSPENDED', suspendedReason: 'TRIAL_EXPIRED' },
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/api/cron/expire-trials/__tests__/route.test.ts`
Expected: FAIL — módulo da rota não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/app/api/cron/expire-trials/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const expired = await prisma.business.findMany({
    where: { status: 'ACTIVE', trialEndsAt: { lt: new Date() } },
    include: { subscriptions: { where: { status: 'ACTIVE' } } },
  })
  const toSuspend = expired.filter((b) => b.subscriptions.length === 0)

  if (toSuspend.length > 0) {
    await prisma.business.updateMany({
      where: { id: { in: toSuspend.map((b) => b.id) } },
      data: { status: 'SUSPENDED', suspendedReason: 'TRIAL_EXPIRED' },
    })
  }

  return NextResponse.json({ suspended: toSuspend.length })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/api/cron/expire-trials/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Configurar o cron na Vercel**

Se `vercel.json` não existir na raiz, criar; se existir, adicionar a chave `crons` preservando o resto do conteúdo:

```json
{
  "crons": [{ "path": "/api/cron/expire-trials", "schedule": "0 6 * * *" }]
}
```

- [ ] **Step 6: Rodar typecheck e todos os testes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/expire-trials vercel.json
git commit -m "feat: daily cron to suspend businesses whose trial expired unpaid"
```

**Nota pós-deploy (não é um step de código):** `CRON_SECRET` precisa ser definida como variável de ambiente no projeto Vercel (`vercel env add CRON_SECRET production`) antes do cron funcionar de verdade — sem ela configurada, o endpoint sempre responde 401 e a Vercel loga a falha, sem quebrar o resto do site.

---

### Task 9: `trialEndsAt` na aprovação do admin

**Files:**
- Modify: `src/actions/admin-actions.ts`
- Modify: `src/actions/__tests__/admin-actions.test.ts`

**Interfaces:**
- Consumes: nada novo — modifica `updateBusinessStatus`, já existente.

- [ ] **Step 1: Escrever os testes novos**

Adicionar dentro do `describe('updateBusinessStatus', ...)` existente, depois do teste `'updates the business status when the admin and business are valid'`:

```typescript
  it('sets a 3-day trial when approving a PENDING business to ACTIVE', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'PENDING' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const before = Date.now()
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    const after = Date.now()

    expect(result).toEqual({ ok: true })
    const call = vi.mocked(prisma.business.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 'biz-1' })
    expect(call.data.status).toBe('ACTIVE')
    const trialEndsAt = (call.data as { trialEndsAt: Date }).trialEndsAt.getTime()
    expect(trialEndsAt).toBeGreaterThanOrEqual(before + 3 * 24 * 60 * 60 * 1000 - 1000)
    expect(trialEndsAt).toBeLessThanOrEqual(after + 3 * 24 * 60 * 60 * 1000 + 1000)
  })

  it('does not reset the trial when reactivating a SUSPENDED business to ACTIVE manually', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', status: 'SUSPENDED' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    await updateBusinessStatus('biz-1', 'ACTIVE')

    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz-1' }, data: { status: 'ACTIVE' } })
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/actions/__tests__/admin-actions.test.ts`
Expected: FAIL — o primeiro teste novo falha porque `trialEndsAt` nunca é setado hoje.

- [ ] **Step 3: Implementar**

Em `src/actions/admin-actions.ts`, dentro de `updateBusinessStatus`, trocar o corpo que hoje é:

```typescript
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  await prisma.business.update({ where: { id: businessId }, data: { status: parsed.data } })

  return { ok: true }
```

por:

```typescript
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  const isApprovingFromPending = business.status === 'PENDING' && parsed.data === 'ACTIVE'
  await prisma.business.update({
    where: { id: businessId },
    data: isApprovingFromPending
      ? { status: parsed.data, trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
      : { status: parsed.data },
  })

  return { ok: true }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/actions/__tests__/admin-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts
git commit -m "feat: start a 3-day trial when a business is approved from PENDING to ACTIVE"
```

---

### Task 10: Bloqueio do painel — `MerchantAccessGate` + `comerciante/layout.tsx`

**Files:**
- Create: `src/components/merchant/MerchantAccessGate.tsx`
- Modify: `src/app/comerciante/layout.tsx`

**Interfaces:**
- Consumes: `auth()` (`@/lib/auth`), `getBusinessForOwner` (`@/lib/merchant`, já existe).

- [ ] **Step 1: Criar `MerchantAccessGate.tsx`**

```typescript
// src/components/merchant/MerchantAccessGate.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MESSAGE: Record<string, { title: string; body: string; showCta: boolean }> = {
  TRIAL_EXPIRED: {
    title: 'Seu período de teste terminou',
    body: 'Assine um plano pra continuar publicando ofertas e acessando o painel.',
    showCta: true,
  },
  PAYMENT_OVERDUE: {
    title: 'Assinatura em atraso',
    body: 'Regularize o pagamento pra voltar a acessar o painel.',
    showCta: true,
  },
  ADMIN: {
    title: 'Conta suspensa',
    body: 'Sua conta foi suspensa. Entre em contato com o suporte pra mais informações.',
    showCta: false,
  },
}

export function MerchantAccessGate({
  suspended,
  suspendedReason,
  children,
}: {
  suspended: boolean
  suspendedReason: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (!suspended || pathname === '/comerciante/plano') {
    return <>{children}</>
  }

  const message = MESSAGE[suspendedReason ?? ''] ?? MESSAGE.TRIAL_EXPIRED

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-8 text-center">
      <h1 className="text-lg font-bold text-neutral-900">{message.title}</h1>
      <p className="max-w-sm text-sm text-neutral-500">{message.body}</p>
      {message.showCta && (
        <Link href="/comerciante/plano" className="mt-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-bold text-white">
          Ver planos
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `src/app/comerciante/layout.tsx`**

```typescript
// src/app/comerciante/layout.tsx
import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { MerchantAccessGate } from '@/components/merchant/MerchantAccessGate'

export default async function ComercianteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const business = session?.user?.id ? await getBusinessForOwner(session.user.id as string) : null
  const suspended = business?.status === 'SUSPENDED'

  return (
    <DashboardShell area="comerciante">
      <MerchantAccessGate suspended={Boolean(suspended)} suspendedReason={business?.suspendedReason ?? null}>
        {children}
      </MerchantAccessGate>
    </DashboardShell>
  )
}
```

- [ ] **Step 3: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros. (Sem teste automatizado dedicado pra este componente — é composição de UI fina sobre dado já testado nos Tasks 6/9; verificação visual acontece no Task 13 via Browser tool, junto da verificação end-to-end.)

- [ ] **Step 4: Commit**

```bash
git add src/components/merchant/MerchantAccessGate.tsx src/app/comerciante/layout.tsx
git commit -m "feat: block the merchant panel when the business is suspended"
```

---

### Task 11: Tela comerciante `/comerciante/plano` + `subscribeToPlan`

**Files:**
- Modify: `src/actions/merchant-actions.ts`
- Modify: `src/actions/__tests__/merchant-actions.test.ts`
- Create: `src/components/merchant/PlanoForm.tsx`
- Create: `src/app/comerciante/plano/page.tsx`

**Interfaces:**
- Consumes: `getPaidPlans` (Task 4), `createAsaasCustomer`/`createAsaasSubscription` (Task 3), `getBusinessForOwner` (já existe).
- Produces: `subscribeToPlan(planId: string, document: string)` server action.

- [ ] **Step 1: Escrever o teste de `subscribeToPlan`**

No topo de `src/actions/__tests__/merchant-actions.test.ts`, adicionar o mock de `@/lib/asaas` junto dos demais `vi.mock`:

```typescript
vi.mock('@/lib/asaas', () => ({
  createAsaasCustomer: vi.fn(),
  createAsaasSubscription: vi.fn(),
}))
```

E adicionar `subscription: { create: vi.fn() }` ao objeto `prisma` dentro do `vi.mock('@/lib/db', ...)` existente (que já tem `user`, `plan`, `city`, `business`, `$transaction` — só falta `subscription`). Importar `createAsaasCustomer, createAsaasSubscription` de `@/lib/asaas` e `subscribeToPlan` de `@/actions/merchant-actions` nos imports do topo do arquivo.

Ao final do arquivo:

```typescript
describe('subscribeToPlan', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not a merchant session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await subscribeToPlan('plan-1', '12345678900')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when no CPF/CNPJ was provided', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await subscribeToPlan('plan-1', '')
    expect(result).toEqual({ ok: false, error: 'Informe seu CPF ou CNPJ.' })
  })

  it('rejects when the plan does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null)

    const result = await subscribeToPlan('plan-1', '12345678900')
    expect(result).toEqual({ ok: false, error: 'Plano não encontrado.' })
  })

  it('creates an Asaas customer when the business has none yet, then the subscription, and returns the invoice url', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(createAsaasCustomer).mockResolvedValue('cus_123')
    vi.mocked(createAsaasSubscription).mockResolvedValue({ subscriptionId: 'sub_123', invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

    const result = await subscribeToPlan('plan-1', '12345678900')

    expect(result).toEqual({ ok: true, invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz-1' }, data: { document: '12345678900', asaasCustomerId: 'cus_123' } })
    expect(createAsaasCustomer).toHaveBeenCalledWith({
      name: 'João', cpfCnpj: '12345678900', email: 'joao@x.com', mobilePhone: '5546999990000', externalReference: 'biz-1',
    })
    expect(createAsaasSubscription).toHaveBeenCalledWith({
      customerId: 'cus_123', value: 49.9, description: 'Plano Básico', externalReference: 'biz-1',
    })
    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: { businessId: 'biz-1', planId: 'plan-1', status: 'PENDING', asaasSubscriptionId: 'sub_123' },
    })
  })

  it('reuses an existing Asaas customer id instead of creating a new one', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: 'biz-1', document: '12345678900', asaasCustomerId: 'cus_existing', whatsapp: '5546999990000', email: null,
      owner: { blocked: false, name: 'João', email: 'joao@x.com' },
    } as never)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
    vi.mocked(createAsaasSubscription).mockResolvedValue({ subscriptionId: 'sub_123', invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

    await subscribeToPlan('plan-1', '12345678900')

    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(createAsaasSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_existing' }),
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/actions/__tests__/merchant-actions.test.ts`
Expected: FAIL — `subscribeToPlan` não existe.

- [ ] **Step 3: Implementar `subscribeToPlan` em `src/actions/merchant-actions.ts`**

```typescript
import { createAsaasCustomer, createAsaasSubscription } from '@/lib/asaas'

export type SubscribeToPlanResult = { ok: true; invoiceUrl: string } | { ok: false; error: string }

export async function subscribeToPlan(planId: string, document: string): Promise<SubscribeToPlanResult> {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'MERCHANT') {
    return { ok: false, error: 'Não autorizado.' }
  }

  if (!document.trim()) {
    return { ok: false, error: 'Informe seu CPF ou CNPJ.' }
  }

  const business = await prisma.business.findFirst({
    where: { ownerId: session.user.id as string },
    include: { owner: { select: { blocked: true, name: true, email: true } } },
  })
  if (!business || business.owner.blocked) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) {
    return { ok: false, error: 'Plano não encontrado.' }
  }

  await prisma.business.update({ where: { id: business.id }, data: { document } })

  let asaasCustomerId = business.asaasCustomerId
  if (!asaasCustomerId) {
    asaasCustomerId = await createAsaasCustomer({
      name: business.owner.name,
      cpfCnpj: document,
      email: business.email ?? business.owner.email,
      mobilePhone: business.whatsapp ?? '',
      externalReference: business.id,
    })
    await prisma.business.update({ where: { id: business.id }, data: { asaasCustomerId } })
  }

  const { subscriptionId, invoiceUrl } = await createAsaasSubscription({
    customerId: asaasCustomerId,
    value: plan.priceCents / 100,
    description: `Plano ${plan.name}`,
    externalReference: business.id,
  })

  await prisma.subscription.create({
    data: { businessId: business.id, planId: plan.id, status: 'PENDING', asaasSubscriptionId: subscriptionId },
  })

  return { ok: true, invoiceUrl }
}
```

Nota: o teste do Step 1 espera **duas** chamadas a `prisma.business.update` no fluxo "cria customer novo" — uma pra salvar `document` (sempre) e outra pra salvar `asaasCustomerId` (só quando não existia). O teste `'creates an Asaas customer...'` verifica só a primeira chamada com `toHaveBeenCalledWith` (que checa se ALGUMA chamada bateu com esse argumento, não a única) — então as duas implementações (uma ou duas chamadas de update) passam nesse teste; a chamada dupla acima é a mais simples de raciocinar (cada write tem uma responsabilidade), mantenha assim.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/actions/__tests__/merchant-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar `PlanoForm.tsx`**

```typescript
// src/components/merchant/PlanoForm.tsx
'use client'

import { useState } from 'react'
import { subscribeToPlan } from '@/actions/merchant-actions'

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PlanoForm({
  plans,
  initialDocument,
}: {
  plans: { id: string; name: string; priceCents: number }[]
  initialDocument: string
}) {
  const [document, setDocument] = useState(initialDocument)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(planId: string) {
    setError(null)
    setPendingPlanId(planId)
    try {
      const result = await subscribeToPlan(planId, document)
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.location.href = result.invoiceUrl
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setPendingPlanId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-neutral-700">
        CPF ou CNPJ
        <input
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Necessário pra assinar um plano"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-6 text-center">
            <p className="text-sm font-bold text-neutral-900">{plan.name}</p>
            <p className="text-2xl font-extrabold text-brand-green">{formatPrice(plan.priceCents)}/mês</p>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={pendingPlanId !== null || !document.trim()}
              className="mt-2 w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
            >
              {pendingPlanId === plan.id ? 'Redirecionando...' : 'Assinar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Criar `/comerciante/plano/page.tsx`**

```typescript
// src/app/comerciante/plano/page.tsx
import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { getPaidPlans } from '@/lib/plans'
import { PlanoForm } from '@/components/merchant/PlanoForm'

function daysLeft(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null
  const ms = trialEndsAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export default async function ComerciantePlanoPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  const plans = await getPaidPlans()

  if (!business) {
    return (
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Meu plano</h1>
        <p className="mt-2 text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
      </div>
    )
  }

  const trialDays = daysLeft(business.trialEndsAt)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Meu plano</h1>
        {business.status === 'SUSPENDED' ? (
          <p className="mt-1 text-sm text-red-600">Seu acesso está bloqueado até você assinar um plano.</p>
        ) : trialDays !== null ? (
          <p className="mt-1 text-sm text-neutral-500">
            {trialDays > 0 ? `Seu período de teste termina em ${trialDays} dia${trialDays === 1 ? '' : 's'}.` : 'Seu período de teste termina hoje.'}
          </p>
        ) : null}
      </div>

      <PlanoForm plans={plans} initialDocument={business.document ?? ''} />
    </div>
  )
}
```

- [ ] **Step 7: Rodar typecheck e todos os testes do site**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 8: Commit**

```bash
git add src/actions/merchant-actions.ts src/actions/__tests__/merchant-actions.test.ts src/components/merchant/PlanoForm.tsx src/app/comerciante/plano
git commit -m "feat: merchant plan subscription screen with Asaas checkout redirect"
```

---

### Task 12: Landing — planos pagos reais em vez de texto fixo

**Files:**
- Modify: `src/components/landing/PricingCards.tsx`
- Modify: `src/components/landing/MerchantSection.tsx`
- Modify: `src/components/landing/LandingPage.tsx`
- Modify: `src/app/(consumer)/page.tsx`

**Interfaces:**
- Consumes: `getPaidPlans` (Task 4).

A landing (feita numa sessão anterior) hoje tem os 3 planos hardcoded com a etiqueta "Em breve". Agora que a cobrança existe de verdade, passa a receber os planos reais e perde essa etiqueta.

- [ ] **Step 1: Atualizar `PricingCards.tsx` pra receber os planos como prop**

```typescript
// src/components/landing/PricingCards.tsx
function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PERK_BY_PLAN_NAME: Record<string, string> = {
  Básico: 'Até 5 ofertas ativas',
  Destaque: 'Aparece também na página inicial + mais ofertas ativas',
  Turbo: 'Destaque no card grande da página inicial',
}

export function PricingCards({ plans }: { plans: { id: string; name: string; priceCents: number }[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-2xl bg-white/5 p-6 text-center">
          <p className="text-sm font-bold text-white">{plan.name}</p>
          <p className="mt-1 text-2xl font-extrabold text-brand-green-light">{formatPrice(plan.priceCents)}/mês</p>
          <p className="mt-3 text-sm text-neutral-300">{PERK_BY_PLAN_NAME[plan.name] ?? ''}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `MerchantSection.tsx` pra repassar os planos**

```typescript
// src/components/landing/MerchantSection.tsx
import Link from 'next/link'
import { Benefits } from './Benefits'
import { PricingCards } from './PricingCards'

export function MerchantSection({ plans }: { plans: { id: string; name: string; priceCents: number }[] }) {
  return (
    <section className="bg-brand-navy-dark px-4 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start gap-4 md:items-center md:text-center">
          <h2 className="text-2xl font-extrabold">Tem uma loja ou restaurante?</h2>
          <p className="max-w-xl text-sm text-neutral-300">
            Publique ofertas, gerencie pedidos e alcance clientes que estão pertinho de você.
          </p>
          <Benefits />
          <Link
            href="/comerciante/cadastro"
            className="mt-2 rounded-lg bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy"
          >
            Cadastrar minha loja
          </Link>
        </div>

        <div className="mt-12">
          <PricingCards plans={plans} />
        </div>
      </div>
    </section>
  )
}
```

(Remove a importação/uso da lista hardcoded `PLANS` antiga, se ainda estiver no arquivo — a lista some, o componente vira 100% dado.)

- [ ] **Step 3: Atualizar `LandingPage.tsx` pra receber e repassar `plans`**

```typescript
// src/components/landing/LandingPage.tsx
import { LandingHeader } from './LandingHeader'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { CategoriesShowcase } from './CategoriesShowcase'
import { CitiesShowcase } from './CitiesShowcase'
import { MerchantSection } from './MerchantSection'
import { LandingFooter } from './LandingFooter'

export function LandingPage({
  categories,
  cities,
  plans,
}: {
  categories: { id: string; name: string; icon: string }[]
  cities: { name: string; state: string }[]
  plans: { id: string; name: string; priceCents: number }[]
}) {
  return (
    <div className="landing-page flex flex-col">
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <CategoriesShowcase categories={categories} />
      <CitiesShowcase cities={cities} />
      <MerchantSection plans={plans} />
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 4: Atualizar `src/app/(consumer)/page.tsx` pra buscar e passar `plans`**

No bloco que hoje é:

```typescript
  if (!location && !city) {
    const [categories, cities] = await Promise.all([getActiveCategories(), getCitiesWithActiveBusinesses()])
    return <LandingPage categories={categories} cities={cities} />
  }
```

trocar por:

```typescript
  if (!location && !city) {
    const [categories, cities, plans] = await Promise.all([
      getActiveCategories(),
      getCitiesWithActiveBusinesses(),
      getPaidPlans(),
    ])
    return <LandingPage categories={categories} cities={cities} plans={plans} />
  }
```

E adicionar o import: `import { getPaidPlans } from '@/lib/plans'` no topo do arquivo.

- [ ] **Step 5: Rodar typecheck e todos os testes do site**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing src/app/(consumer)/page.tsx
git commit -m "feat: landing page pricing cards driven by real Plan data"
```

---

### Task 13: Verificação end-to-end e deploy

**Files:** nenhum arquivo novo — task de verificação e publicação.

- [ ] **Step 1: Rodar a suíte completa do site**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 2: Rodar o seed local e verificar manualmente no browser**

Run: `npx prisma db seed`

Iniciar o dev server (`preview_start` com a config `aki-ofertas-dev` já existente em `.claude/launch.json`) e, via Browser tool:
- Acessar `/admin/configuracoes`, preencher uma chave de sandbox fake, salvar, recarregar e confirmar que o placeholder muda pra "já configurada".
- Acessar `/admin/planos`, confirmar que `Básico`/`Destaque`/`Turbo` aparecem com os preços certos.
- Acessar `/` sem cookie de localização e confirmar que a landing mostra os 3 planos reais, sem a etiqueta "Em breve".
- Logar como o comerciante seed (`joao@bigburger.com.br` / `comerciante123`), acessar `/comerciante/plano`, confirmar que a tela carrega os 3 planos (sem chave de API real configurada em sandbox de verdade, o clique em "Assinar" vai falhar na chamada ao Asaas — isso é esperado nesta verificação local, já que não há conta Asaas de teste configurada neste ambiente; confirmar que o erro aparece formatado na tela, não uma página de erro genérica do Next).
- Simular uma empresa suspensa diretamente no banco (`UPDATE "Business" SET status='SUSPENDED', "suspendedReason"='TRIAL_EXPIRED' WHERE slug='big-burger'` via script Node com Prisma, revertendo depois) e confirmar que `/comerciante` mostra a tela de bloqueio com o botão "Ver planos", enquanto `/comerciante/plano` continua acessível.

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build limpo, sem erros.

- [ ] **Step 4: Aplicar a migration em produção**

Run: `npx prisma migrate deploy` (contra o `DATABASE_URL` de produção — mesmo fluxo já usado pras migrations anteriores deste projeto) e `npx prisma db seed` (idempotente via upsert — seguro rodar de novo em produção, só atualiza/cria os planos e dados de exemplo que já existem).

- [ ] **Step 5: Deploy**

Run: `npx vercel --prod`

- [ ] **Step 6: Configurar `CRON_SECRET` na Vercel (se ainda não existir)**

Run: `vercel env add CRON_SECRET production` (gerar um valor aleatório forte, ex: `openssl rand -hex 32`).

- [ ] **Step 7: Verificação ao vivo em produção**

Via Browser tool: confirmar que `/admin/configuracoes` e `/admin/planos` carregam sem erro em produção (logado como admin), e que a landing (`https://akiofertas.com.br` sem cookie de localização) mostra os planos reais. Checar console/network por erros.

**Nota:** a configuração real das chaves do Asaas (sandbox e produção) e o primeiro teste de assinatura ponta-a-ponta dependem da conta Asaas que o usuário ainda vai criar (fora do escopo deste plano — ver conversa) — quando ele colar as chaves em `/admin/configuracoes`, o fluxo já estará pronto pra funcionar sem nenhuma mudança de código adicional.
