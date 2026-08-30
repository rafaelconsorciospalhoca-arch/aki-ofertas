# Sobrescrita de Comissão por Comerciante Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o admin sobrescrever, por comerciante individual, o percentual de comissão que hoje só é definido por categoria — forçando um percentual diferente ou tirando o comerciante do modelo de comissão.

**Architecture:** Dois campos novos em `Business` (`commissionOverrideEnabled`, `commissionOverridePercent`). Uma função central (`getEffectiveCommissionPercent`) substitui toda leitura direta de `business.category.commissionPercent` no código já existente. Nova página de detalhe no admin (`/admin/empresas/[id]`, hoje inexistente — só há listagem) com o controle de override.

**Tech Stack:** Next.js 14 (App Router, Server Actions), Prisma/Postgres, Vitest.

## Global Constraints

- `commissionOverrideEnabled: false` (padrão) = usa o percentual da categoria, sem mudança de comportamento.
- `commissionOverrideEnabled: true, commissionOverridePercent: null` = força **sem comissão** (mensalidade), mesmo que a categoria cobre.
- `commissionOverrideEnabled: true, commissionOverridePercent: N` = força comissão de `N`%, independente da categoria.
- `getEffectiveCommissionPercent` é a **única** função que decide isso em todo o código — nenhum outro ponto volta a ler `business.category.commissionPercent` diretamente depois deste plano.
- Onde uma query hoje filtra por `category: { commissionPercent: ... }` direto no `where` do Prisma (para reduzir o que é buscado do banco), a troca é: buscar sem esse filtro (incluindo `category`) e filtrar em memória com `getEffectiveCommissionPercent` — combinar categoria+override numa única condição de banco não compensa a complexidade, e o volume de negócios é pequeno (mercado hiperlocal).
- Autorização das novas actions/página do admin usa `requireAdmin()`, mesmo padrão já usado em `updateCategory`/`updateUser`.

---

### Task 1: Schema — `Business.commissionOverrideEnabled`/`commissionOverridePercent`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Business.commissionOverrideEnabled Boolean @default(false)`, `Business.commissionOverridePercent Int?`.

- [ ] **Step 1: Adicionar os dois campos ao modelo `Business`**

Em `prisma/schema.prisma`, no modelo `Business`, adicionar (perto dos outros campos de billing, como `asaasCustomerId`):

```prisma
  commissionOverrideEnabled Boolean @default(false)
  commissionOverridePercent Int?
```

- [ ] **Step 2: Gerar e aplicar a migration, gerar o client**

```bash
npx prisma migrate dev --name add_business_commission_override
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add per-business commission override fields"
```

---

### Task 2: `lib/commission.ts` — função central

**Files:**
- Create: `src/lib/commission.ts`
- Create: `src/lib/__tests__/commission.test.ts`

**Interfaces:**
- Produces: `getEffectiveCommissionPercent(business: { commissionOverrideEnabled: boolean; commissionOverridePercent: number | null; category: { commissionPercent: number | null } }): number | null`

- [ ] **Step 1: Criar `src/lib/commission.ts`**

```ts
export type CommissionEligibleBusiness = {
  commissionOverrideEnabled: boolean
  commissionOverridePercent: number | null
  category: { commissionPercent: number | null }
}

export function getEffectiveCommissionPercent(business: CommissionEligibleBusiness): number | null {
  if (business.commissionOverrideEnabled) return business.commissionOverridePercent
  return business.category.commissionPercent
}
```

- [ ] **Step 2: Testes em `src/lib/__tests__/commission.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { getEffectiveCommissionPercent } from '@/lib/commission'

describe('getEffectiveCommissionPercent', () => {
  it('uses the category percent when the override is off', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: false,
      commissionOverridePercent: 99,
      category: { commissionPercent: 10 },
    })
    expect(result).toBe(10)
  })

  it('uses the override percent when the override is on', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: true,
      commissionOverridePercent: 15,
      category: { commissionPercent: 10 },
    })
    expect(result).toBe(15)
  })

  it('forces no commission when the override is on with a null percent, even if the category charges', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: true,
      commissionOverridePercent: null,
      category: { commissionPercent: 10 },
    })
    expect(result).toBeNull()
  })

  it('stays null when neither the override nor the category charges commission', () => {
    const result = getEffectiveCommissionPercent({
      commissionOverrideEnabled: false,
      commissionOverridePercent: null,
      category: { commissionPercent: null },
    })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/commission.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/commission.ts src/lib/__tests__/commission.test.ts
git commit -m "feat: central helper for effective per-business commission percent"
```

---

### Task 3: Usar o helper no cron semanal, no bloqueio por atraso e no cron de trial

**Files:**
- Modify: `src/lib/weekly-commission.ts`
- Modify: `src/lib/__tests__/weekly-commission.test.ts`
- Modify: `src/lib/billing.ts`
- Modify: `src/lib/__tests__/billing.test.ts`
- Modify: `src/app/api/cron/expire-trials/route.ts`
- Modify: `src/app/api/cron/expire-trials/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getEffectiveCommissionPercent` de `src/lib/commission.ts` (Task 2).

- [ ] **Step 1: `src/lib/weekly-commission.ts`**

Ler o arquivo primeiro. Adicionar o import:

```ts
import { getEffectiveCommissionPercent } from '@/lib/commission'
```

Trocar a query (remove o filtro de categoria do `where`, já que agora precisa considerar o override também):

```ts
  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE' },
    include: { category: true, owner: true },
  })
```

E trocar a linha que lê o percentual:

```ts
    const percent = getEffectiveCommissionPercent(business)
```

(no lugar de `const percent = business.category.commissionPercent`). O restante da função não muda — o `if (percent === null) { skipped++; continue }` logo abaixo já existe e passa a ser o único filtro real.

- [ ] **Step 2: Atualizar `src/lib/__tests__/weekly-commission.test.ts`**

Ler o arquivo primeiro. O fixture `commissionBusiness` (e qualquer variação dele usada nos testes) precisa ganhar `commissionOverrideEnabled: false, commissionOverridePercent: null` (mantendo o comportamento atual — sem override, usa a categoria). Adicionar um novo teste ao `describe('generateWeeklyCommissionInvoices', ...)`:

```ts
it('uses a business-level override percent instead of the category default', async () => {
  vi.mocked(prisma.business.findMany).mockResolvedValue([
    { ...commissionBusiness, commissionOverrideEnabled: true, commissionOverridePercent: 20 },
  ] as never)
  vi.mocked(prisma.commissionInvoice.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.order.findMany).mockResolvedValue([{ discountPrice: 10000, quantity: 1, offer: { discountPrice: 10000 } }] as never)
  vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)
  vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_123' })

  const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

  expect(result).toEqual({ created: 1, skipped: 0, failed: 0 })
  expect(prisma.commissionInvoice.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ percent: 20, feeCents: 2000 }) }),
  )
})
```

(Ajustar o shape exato do mock de `prisma.order.findMany` pro que o restante do arquivo já usa — ler o arquivo primeiro pra copiar o formato certo, incluindo se o campo é `offer: { discountPrice }` aninhado como no restante dos testes já existentes.)

- [ ] **Step 3: `src/lib/billing.ts`**

Ler o arquivo primeiro. Adicionar o import `getEffectiveCommissionPercent` de `@/lib/commission`. Em `suspendForPayment`, trocar:

```ts
  if (business && business.category.commissionPercent !== null) return
```

por:

```ts
  if (business && getEffectiveCommissionPercent(business) !== null) return
```

- [ ] **Step 4: Atualizar `src/lib/__tests__/billing.test.ts`**

Ler o arquivo primeiro. Os fixtures de `business` usados no `describe('suspendForPayment', ...)` (incluindo o que já tem `category: { commissionPercent: null }` e o que tem `category: { commissionPercent: 10 }`, adicionados numa feature anterior) precisam ganhar `commissionOverrideEnabled: false, commissionOverridePercent: null` pra manter o comportamento atual sem mudança. Adicionar um novo teste:

```ts
it('does not suspend a business whose category has no commission but has a forced commission override', async () => {
  vi.mocked(prisma.subscription.findFirst).mockResolvedValue({ id: 'sub-local-1', businessId: 'biz-1' } as never)
  vi.mocked(prisma.business.findUnique).mockResolvedValue({
    id: 'biz-1', suspendedReason: null,
    commissionOverrideEnabled: true, commissionOverridePercent: 15,
    category: { commissionPercent: null },
  } as never)

  await suspendForPayment('sub_123')

  expect(prisma.business.update).not.toHaveBeenCalled()
})
```

- [ ] **Step 5: `src/app/api/cron/expire-trials/route.ts`**

Ler o arquivo primeiro. Adicionar o import `getEffectiveCommissionPercent` de `@/lib/commission`. Trocar:

```ts
  const expired = await prisma.business.findMany({
    where: { status: 'ACTIVE', trialEndsAt: { lt: new Date() }, category: { commissionPercent: null } },
    include: { subscriptions: { where: { status: 'ACTIVE' } } },
  })
  const toSuspend = expired.filter((b) => b.subscriptions.length === 0)
```

por:

```ts
  const expired = await prisma.business.findMany({
    where: { status: 'ACTIVE', trialEndsAt: { lt: new Date() } },
    include: { subscriptions: { where: { status: 'ACTIVE' } }, category: true },
  })
  const toSuspend = expired.filter((b) => b.subscriptions.length === 0 && getEffectiveCommissionPercent(b) === null)
```

- [ ] **Step 6: Atualizar `src/app/api/cron/expire-trials/__tests__/route.test.ts`**

Ler o arquivo primeiro. O teste `'suspends only ACTIVE businesses past their trial with no active subscription'` afirma o `where` exato passado a `findMany` — atualizar essa asserção pra remover `category: { commissionPercent: null }` do `where` esperado. Os fixtures de negócio retornados pelo mock (`{ id: 'biz-1', subscriptions: [] }` etc.) precisam ganhar `category: { commissionPercent: null }, commissionOverrideEnabled: false, commissionOverridePercent: null` (comerciante sem comissão nenhuma — comportamento atual preservado). Adicionar um novo teste:

```ts
it('does not suspend a business excluded from trial expiry by a commission override', async () => {
  process.env.CRON_SECRET = 'the-secret'
  vi.mocked(prisma.business.findMany).mockResolvedValue([
    {
      id: 'biz-1', subscriptions: [],
      category: { commissionPercent: null },
      commissionOverrideEnabled: true, commissionOverridePercent: 10,
    },
  ] as never)
  vi.mocked(prisma.business.updateMany).mockResolvedValue({ count: 0 } as never)

  const response = await GET(request('Bearer the-secret'))

  expect(await response.json()).toEqual({ suspended: 0 })
  expect(prisma.business.updateMany).not.toHaveBeenCalled()
})
```

- [ ] **Step 7: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/weekly-commission.test.ts src/lib/__tests__/billing.test.ts src/app/api/cron/expire-trials/__tests__/route.test.ts
```
Esperado: todos passando.

- [ ] **Step 8: Commit**

```bash
git add src/lib/weekly-commission.ts src/lib/__tests__/weekly-commission.test.ts src/lib/billing.ts src/lib/__tests__/billing.test.ts src/app/api/cron/expire-trials
git commit -m "feat: honor per-business commission override in weekly billing, payment suspension, and trial expiry"
```

---

### Task 4: Usar o helper na isenção de mensalidade e no painel do comerciante

**Files:**
- Modify: `src/actions/merchant-actions.ts`
- Modify: `src/actions/__tests__/merchant-actions.test.ts`
- Modify: `src/app/comerciante/plano/page.tsx`

**Interfaces:**
- Consumes: `getEffectiveCommissionPercent` de `src/lib/commission.ts` (Task 2).

- [ ] **Step 1: `src/actions/merchant-actions.ts`**

Ler o arquivo primeiro (por volta da linha 168-211). Adicionar o import `getEffectiveCommissionPercent` de `@/lib/commission`. Trocar:

```ts
  if (business.category.commissionPercent !== null) {
```

por:

```ts
  if (getEffectiveCommissionPercent(business) !== null) {
```

(A query que busca `business` já inclui `category: { select: { commissionPercent: true } }`, que é exatamente o shape que a função espera; os campos `commissionOverrideEnabled`/`commissionOverridePercent` do próprio negócio já vêm automaticamente, já que a query usa `include` sem `select` no nível raiz.)

- [ ] **Step 2: Atualizar `src/actions/__tests__/merchant-actions.test.ts`**

Ler o `describe('subscribeToPlan', ...)` primeiro. Todos os fixtures de `business` nesse describe (que já têm `category: { commissionPercent: null }` ou `category: { commissionPercent: 10 }` de uma feature anterior) precisam ganhar `commissionOverrideEnabled: false, commissionOverridePercent: null`, preservando o comportamento atual. Adicionar um novo teste:

```ts
it('skips Asaas billing when a commission override forces commission even without a category default', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
  vi.mocked(prisma.business.findFirst).mockResolvedValue({
    id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
    commissionOverrideEnabled: true, commissionOverridePercent: 20,
    category: { commissionPercent: null },
    owner: { blocked: false, name: 'João', email: 'joao@x.com' },
  } as never)
  vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
  vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

  const result = await subscribeToPlan('plan-1', '12345678900')

  expect(result).toEqual({ ok: true, invoiceUrl: null })
  expect(createAsaasCustomer).not.toHaveBeenCalled()
  expect(createAsaasSubscription).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: `src/app/comerciante/plano/page.tsx`**

Ler o arquivo primeiro. Adicionar o import `getEffectiveCommissionPercent` de `@/lib/commission`. Trocar:

```ts
  const commissionPercent = business.category.commissionPercent
```

por:

```ts
  const commissionPercent = getEffectiveCommissionPercent(business)
```

- [ ] **Step 4: Rodar os testes e verificar tipos/build**

```bash
npx vitest run src/actions/__tests__/merchant-actions.test.ts
npx tsc --noEmit
npm run build
```
Esperado: tudo passando/sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/actions/merchant-actions.ts src/actions/__tests__/merchant-actions.test.ts src/app/comerciante/plano/page.tsx
git commit -m "feat: honor per-business commission override in subscription exemption and merchant panel"
```

---

### Task 5: Admin — página de detalhe da empresa com o controle de override

**Files:**
- Modify: `src/lib/admin.ts`
- Modify: `src/actions/admin-actions.ts`
- Modify: `src/actions/__tests__/admin-actions.test.ts`
- Create: `src/components/admin/BusinessCommissionForm.tsx`
- Create: `src/app/admin/empresas/[id]/page.tsx`
- Modify: `src/app/admin/empresas/page.tsx`

**Interfaces:**
- Produces: `getBusinessById(id: string)` em `src/lib/admin.ts` — retorna o negócio com `category` e `owner` (nome/e-mail) incluídos, ou `null`.
- Produces: `updateBusinessCommissionOverride(businessId: string, input: { mode: 'CATEGORY_DEFAULT' | 'FORCE_PERCENT' | 'FORCE_NONE'; percent?: string }): Promise<{ ok: true } | { ok: false; error: string }>` em `src/actions/admin-actions.ts`.

- [ ] **Step 1: Adicionar `getBusinessById` em `src/lib/admin.ts`**

Ler o arquivo primeiro (já tem `getBusinessesForAdmin`, `getCategoryById`, etc. — mesmo padrão). Adicionar:

```ts
export async function getBusinessById(id: string) {
  return prisma.business.findUnique({
    where: { id },
    include: { category: true, owner: { select: { name: true, email: true } } },
  })
}
```

- [ ] **Step 2: Adicionar `updateBusinessCommissionOverride` em `src/actions/admin-actions.ts`**

Ler o arquivo primeiro pra ver onde `requireAdmin`/`updateCategory` estão definidos e seguir o mesmo estilo. Adicionar:

```ts
const commissionOverrideSchema = z.object({
  mode: z.enum(['CATEGORY_DEFAULT', 'FORCE_PERCENT', 'FORCE_NONE']),
  percent: z.string().optional(),
})

export async function updateBusinessCommissionOverride(
  businessId: string,
  input: z.infer<typeof commissionOverrideSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = commissionOverrideSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Dados inválidos.' }
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  if (parsed.data.mode === 'CATEGORY_DEFAULT') {
    await prisma.business.update({
      where: { id: businessId },
      data: { commissionOverrideEnabled: false, commissionOverridePercent: null },
    })
    return { ok: true }
  }

  if (parsed.data.mode === 'FORCE_NONE') {
    await prisma.business.update({
      where: { id: businessId },
      data: { commissionOverrideEnabled: true, commissionOverridePercent: null },
    })
    return { ok: true }
  }

  const percent = Number(parsed.data.percent)
  if (!parsed.data.percent || !Number.isInteger(percent) || percent < 0 || percent > 100) {
    return { ok: false, error: 'Percentual de comissão inválido.' }
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { commissionOverrideEnabled: true, commissionOverridePercent: percent },
  })
  return { ok: true }
}
```

- [ ] **Step 3: Testes em `src/actions/__tests__/admin-actions.test.ts`**

Ler o arquivo primeiro pra reaproveitar o padrão de `mockUsersById`/`activeAdmin` já usado em outros `describe`s (ex.: `describe('updateUser', ...)`). Adicionar:

```ts
describe('updateBusinessCommissionOverride', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not an admin', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'CATEGORY_DEFAULT' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the business does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'CATEGORY_DEFAULT' })
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('rejects an invalid percent when forcing a commission', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'FORCE_PERCENT', percent: '150' })
    expect(result).toEqual({ ok: false, error: 'Percentual de comissão inválido.' })
  })

  it('clears the override when set back to the category default', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'CATEGORY_DEFAULT' })

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { commissionOverrideEnabled: false, commissionOverridePercent: null },
    })
  })

  it('forces no commission', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'FORCE_NONE' })

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { commissionOverrideEnabled: true, commissionOverridePercent: null },
    })
  })

  it('forces a specific commission percent', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessCommissionOverride('biz-1', { mode: 'FORCE_PERCENT', percent: '20' })

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { commissionOverrideEnabled: true, commissionOverridePercent: 20 },
    })
  })
})
```

(Usar o `activeAdmin`/mock de `prisma.user.findUnique` exatamente como o restante do arquivo já faz pra `requireAdmin()` — ler o arquivo primeiro pra confirmar o nome exato dessa fixture, já usada em outros `describe`s.)

- [ ] **Step 4: Criar `src/components/admin/BusinessCommissionForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusinessCommissionOverride } from '@/actions/admin-actions'

type Mode = 'CATEGORY_DEFAULT' | 'FORCE_PERCENT' | 'FORCE_NONE'

export function BusinessCommissionForm({
  businessId,
  categoryPercent,
  initialMode,
  initialPercent,
}: {
  businessId: string
  categoryPercent: number | null
  initialMode: Mode
  initialPercent: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [percent, setPercent] = useState(initialPercent)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const result = await updateBusinessCommissionOverride(businessId, { mode, percent })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(true)
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-bold text-neutral-900">Comissão de entrega</h2>
      <p className="text-xs text-neutral-500">
        Padrão da categoria: {categoryPercent !== null ? `${categoryPercent}%` : 'sem comissão'}
      </p>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="radio" name="mode" checked={mode === 'CATEGORY_DEFAULT'} onChange={() => setMode('CATEGORY_DEFAULT')} />
        Usar padrão da categoria
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="radio" name="mode" checked={mode === 'FORCE_PERCENT'} onChange={() => setMode('FORCE_PERCENT')} />
        Forçar comissão de
        <input
          type="number"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => {
            setPercent(e.target.value)
            setMode('FORCE_PERCENT')
          }}
          className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
        />
        %
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="radio" name="mode" checked={mode === 'FORCE_NONE'} onChange={() => setMode('FORCE_NONE')} />
        Forçar mensalidade (sem comissão)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Salvo.</p>}

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

- [ ] **Step 5: Criar `src/app/admin/empresas/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getBusinessById } from '@/lib/admin'
import { BusinessCommissionForm } from '@/components/admin/BusinessCommissionForm'

export default async function AdminEmpresaDetailPage({ params }: { params: { id: string } }) {
  const business = await getBusinessById(params.id)
  if (!business) {
    notFound()
  }

  const initialMode = business.commissionOverrideEnabled
    ? business.commissionOverridePercent !== null
      ? 'FORCE_PERCENT'
      : 'FORCE_NONE'
    : 'CATEGORY_DEFAULT'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{business.name}</h1>
        <p className="text-sm text-neutral-500">
          {business.category.name} · {business.owner.name} ({business.owner.email})
        </p>
      </div>
      <BusinessCommissionForm
        businessId={business.id}
        categoryPercent={business.category.commissionPercent}
        initialMode={initialMode}
        initialPercent={business.commissionOverridePercent !== null ? String(business.commissionOverridePercent) : ''}
      />
    </div>
  )
}
```

- [ ] **Step 6: Linkar a partir da listagem em `src/app/admin/empresas/page.tsx`**

Ler o arquivo primeiro. Trocar o `<p className="text-sm font-bold text-neutral-900">{business.name}</p>` (nome da empresa, sem link hoje) por um `Link` para `/admin/empresas/${business.id}`:

```tsx
                <Link href={`/admin/empresas/${business.id}`} className="text-sm font-bold text-neutral-900 hover:underline">
                  {business.name}
                </Link>
```

(O import de `Link` já existe no topo do arquivo.)

- [ ] **Step 7: Rodar os testes e verificar tipos/build**

```bash
npx vitest run src/actions/__tests__/admin-actions.test.ts
npx tsc --noEmit
npm run build
```
Esperado: tudo passando/sem erros, rota `/admin/empresas/[id]` aparece no build.

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin.ts src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts src/components/admin/BusinessCommissionForm.tsx src/app/admin/empresas
git commit -m "feat: admin can override a business's commission percent individually"
```

---

### Task 6: Build final, testes completos e deploy

**Files:** nenhum novo — apenas execução e verificação.

- [ ] **Step 1: Testes e tipos**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Esperado: tudo passando/sem erros.

- [ ] **Step 2: Deploy**

```bash
npx vercel --prod
```
Se falhar com o erro transitório `"Not authorized"`, rodar `npx vercel link --yes` e tentar de novo.

- [ ] **Step 3: Verificação manual em produção**

Usando o navegador: em `/admin/empresas`, clicar no nome de uma empresa e confirmar que abre `/admin/empresas/[id]` com o formulário de comissão, mostrando o padrão atual da categoria e as três opções.
