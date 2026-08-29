# Taxa de Entrega por Bairro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o comerciante cadastrar uma taxa de entrega por bairro e o cliente escolher o bairro (de uma lista, não texto livre) no pedido do app mobile, com a taxa somada ao total.

**Architecture:** Novo modelo `DeliveryZone` (um por bairro/comerciante) mais um campo snapshot `Order.deliveryFeeCents`. Painel do comerciante (Next.js, `src/`) ganha uma aba CRUD simples seguindo o padrão já usado em `MenuManager`/`menu-actions.ts`. API mobile (`src/app/api/mobile/...`) expõe as zonas na oferta e passa a exigir `deliveryZoneId` no lugar do texto livre de bairro. App mobile (`app-mobile/`) troca o campo de texto por uma lista de seleção e adiciona o fluxo "bairro fora da área" que dispara um e-mail de aviso pro comerciante.

**Tech Stack:** Next.js 14 (App Router, Server Actions), Prisma/Postgres, Vitest; Expo Router / React Native, Jest, TanStack Query.

## Global Constraints

- Bairros são cadastrados **por comerciante** (Business), não por oferta — uma lista compartilhada por todas as ofertas com entrega daquele comerciante.
- O cliente **só escolhe entre os bairros cadastrados pelo comerciante** — nunca digita o bairro livremente no fluxo normal de pedido.
- Se o comerciante não tiver nenhum bairro ativo cadastrado, o botão "Pedir com entrega" **não aparece** na tela da oferta — só o cupom para retirada.
- O valor da taxa (`feeCents`) é copiado (snapshot) para o `Order` no momento da criação — mudanças posteriores na `DeliveryZone` não alteram pedidos já feitos.
- Nome do bairro é único por comerciante: `@@unique([businessId, neighborhood])`.
- Site (`src/app/oferta/[slug]/page.tsx`) **não muda** — ele só tem o fluxo de cupom/retirada, sem pedido com entrega. Esta feature é mobile-only no lado do cliente.
- Todas as novas funções de dados/actions seguem o padrão de autorização já existente: `requireMerchantBusiness()` de `src/actions/offer-actions.ts` para o lado comerciante; `requireMobileUser(request)` de `src/lib/mobile-session.ts` para as rotas mobile.
- Preço em reais no formulário do painel usa `reaisToCents`/`centsToReais` de `src/lib/money.ts` (mesmo padrão do cardápio).
- App mobile não tem testes de renderização de componente (nenhuma dependência de Testing Library é usada nos testes existentes) — lógica nova testável deve ser extraída como função pura e testada isoladamente, como em `app-mobile/src/components/CategoryGrid.tsx` (`firstWord`) e seu teste.

---

### Task 1: Schema — modelo `DeliveryZone` e `Order.deliveryFeeCents`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: modelo `DeliveryZone { id, businessId, business, neighborhood, feeCents, active, createdAt }`, mapeado para `delivery_zones`, com `@@unique([businessId, neighborhood])`.
- Produces: `Business.deliveryZones DeliveryZone[]`.
- Produces: `Order.deliveryFeeCents Int?` (nullable).

- [ ] **Step 1: Adicionar o modelo `DeliveryZone`**

Em `prisma/schema.prisma`, logo após o modelo `MenuItem` (antes de `BusinessHours`), adicionar:

```prisma
model DeliveryZone {
  id           String   @id @default(cuid())
  businessId   String
  business     Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  neighborhood String
  feeCents     Int
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@unique([businessId, neighborhood])
  @@map("delivery_zones")
}
```

- [ ] **Step 2: Ligar `Business` ao novo modelo**

No modelo `Business`, no bloco de relações (perto de `menuItems MenuItem[]` e `orders Order[]`), adicionar:

```prisma
  deliveryZones   DeliveryZone[]
```

- [ ] **Step 3: Adicionar `deliveryFeeCents` em `Order`**

No modelo `Order`, logo abaixo do campo `neighborhood`, adicionar:

```prisma
  deliveryFeeCents Int?
```

- [ ] **Step 4: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name add_delivery_zones
```

Confirmar que a migration é criada em `prisma/migrations/` e aplica sem erro contra o banco de dev.

- [ ] **Step 5: Gerar o client**

```bash
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add DeliveryZone model and Order.deliveryFeeCents"
```

---

### Task 2: Dados e server actions do painel do comerciante

**Files:**
- Modify: `src/lib/merchant.ts`
- Create: `src/actions/delivery-zone-actions.ts`
- Create: `src/actions/__tests__/delivery-zone-actions.test.ts`

**Interfaces:**
- Consumes: `requireMerchantBusiness()` de `src/actions/offer-actions.ts` (retorna `{ id, ... } | null`).
- Consumes: `reaisToCents(value: string): number | null`, `centsToReais(cents: number): string` de `src/lib/money.ts`.
- Produces: `getDeliveryZonesForOwner(businessId: string): Promise<DeliveryZone[]>` em `src/lib/merchant.ts`.
- Produces (em `delivery-zone-actions.ts`, todos `'use server'`):
  - `upsertDeliveryZone(input: { id?: string; neighborhood: string; feeCents: string }): Promise<{ ok: true; zoneId: string } | { ok: false; error: string }>`
  - `deleteDeliveryZone(id: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `toggleDeliveryZoneActive(id: string, active: boolean): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Adicionar `getDeliveryZonesForOwner` em `src/lib/merchant.ts`**

Seguindo o padrão de `getMenuItemsForOwner` no mesmo arquivo:

```ts
export async function getDeliveryZonesForOwner(businessId: string) {
  return prisma.deliveryZone.findMany({
    where: { businessId },
    orderBy: { neighborhood: 'asc' },
  })
}
```

- [ ] **Step 2: Criar `src/actions/delivery-zone-actions.ts`**

```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { reaisToCents } from '@/lib/money'

const zoneSchema = z.object({
  id: z.string().optional(),
  neighborhood: z.string().min(2, 'Informe o nome do bairro.'),
  feeCents: z.string().min(1, 'Informe o valor da taxa.'),
})

type ZoneInput = z.infer<typeof zoneSchema>
type ZoneResult = { ok: true; zoneId: string } | { ok: false; error: string }

export async function upsertDeliveryZone(input: ZoneInput): Promise<ZoneResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = zoneSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const feeCents = reaisToCents(parsed.data.feeCents)
  if (feeCents === null || feeCents < 0) {
    return { ok: false, error: 'Informe um valor de taxa válido.' }
  }

  const neighborhood = parsed.data.neighborhood.trim()

  if (parsed.data.id) {
    const existing = await prisma.deliveryZone.findFirst({
      where: { id: parsed.data.id, businessId: business.id },
    })
    if (!existing) {
      return { ok: false, error: 'Bairro não encontrado.' }
    }
    const updated = await prisma.deliveryZone.update({
      where: { id: existing.id },
      data: { neighborhood, feeCents },
    })
    return { ok: true, zoneId: updated.id }
  }

  const zone = await prisma.deliveryZone.upsert({
    where: { businessId_neighborhood: { businessId: business.id, neighborhood } },
    update: { feeCents, active: true },
    create: { businessId: business.id, neighborhood, feeCents },
  })

  return { ok: true, zoneId: zone.id }
}

export async function deleteDeliveryZone(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.deliveryZone.findFirst({ where: { id, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Bairro não encontrado.' }
  }

  await prisma.deliveryZone.delete({ where: { id } })
  return { ok: true }
}

export async function toggleDeliveryZoneActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.deliveryZone.findFirst({ where: { id, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Bairro não encontrado.' }
  }

  await prisma.deliveryZone.update({ where: { id }, data: { active } })
  return { ok: true }
}
```

Nota: `upsertDeliveryZone` com `id` faz `update` direto (permite renomear um bairro existente sem esbarrar na constraint única contra si mesmo); sem `id`, usa `upsert` pela chave composta `businessId_neighborhood` — cadastrar de novo um nome já existente atualiza a taxa em vez de duplicar, conforme a spec.

- [ ] **Step 3: Escrever os testes em `src/actions/__tests__/delivery-zone-actions.test.ts`**

Seguir exatamente o estilo de `src/lib/__tests__/orders.test.ts` (mock de `@/lib/db` e de `@/actions/offer-actions`):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { upsertDeliveryZone, deleteDeliveryZone, toggleDeliveryZoneActive } from '@/actions/delivery-zone-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    deliveryZone: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  },
}))

const business = { id: 'biz-1' }

describe('upsertDeliveryZone', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await upsertDeliveryZone({ neighborhood: 'Centro', feeCents: '5.00' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid fee', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    const result = await upsertDeliveryZone({ neighborhood: 'Centro', feeCents: 'abc' })
    expect(result).toEqual({ ok: false, error: 'Informe um valor de taxa válido.' })
  })

  it('creates a new zone via upsert keyed by business+neighborhood', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.upsert).mockResolvedValue({ id: 'zone-1' } as never)

    const result = await upsertDeliveryZone({ neighborhood: 'Centro', feeCents: '5.00' })

    expect(result).toEqual({ ok: true, zoneId: 'zone-1' })
    expect(prisma.deliveryZone.upsert).toHaveBeenCalledWith({
      where: { businessId_neighborhood: { businessId: 'biz-1', neighborhood: 'Centro' } },
      update: { feeCents: 500, active: true },
      create: { businessId: 'biz-1', neighborhood: 'Centro', feeCents: 500 },
    })
  })

  it('updates an existing zone by id, scoped to the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.deliveryZone.update).mockResolvedValue({ id: 'zone-1' } as never)

    const result = await upsertDeliveryZone({ id: 'zone-1', neighborhood: 'Centro', feeCents: '7.50' })

    expect(result).toEqual({ ok: true, zoneId: 'zone-1' })
    expect(prisma.deliveryZone.update).toHaveBeenCalledWith({
      where: { id: 'zone-1' },
      data: { neighborhood: 'Centro', feeCents: 750 },
    })
  })

  it('rejects updating a zone that does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue(null)

    const result = await upsertDeliveryZone({ id: 'zone-of-another-biz', neighborhood: 'Centro', feeCents: '5.00' })
    expect(result).toEqual({ ok: false, error: 'Bairro não encontrado.' })
    expect(prisma.deliveryZone.update).not.toHaveBeenCalled()
  })
})

describe('deleteDeliveryZone', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects deleting a zone from another business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue(null)

    const result = await deleteDeliveryZone('zone-1')
    expect(result).toEqual({ ok: false, error: 'Bairro não encontrado.' })
    expect(prisma.deliveryZone.delete).not.toHaveBeenCalled()
  })

  it('deletes a zone owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', businessId: 'biz-1' } as never)

    const result = await deleteDeliveryZone('zone-1')
    expect(result).toEqual({ ok: true })
    expect(prisma.deliveryZone.delete).toHaveBeenCalledWith({ where: { id: 'zone-1' } })
  })
})

describe('toggleDeliveryZoneActive', () => {
  afterEach(() => vi.clearAllMocks())

  it('toggles active state for a zone owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', businessId: 'biz-1' } as never)

    const result = await toggleDeliveryZoneActive('zone-1', false)
    expect(result).toEqual({ ok: true })
    expect(prisma.deliveryZone.update).toHaveBeenCalledWith({ where: { id: 'zone-1' }, data: { active: false } })
  })
})
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/actions/__tests__/delivery-zone-actions.test.ts
```
Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/merchant.ts src/actions/delivery-zone-actions.ts src/actions/__tests__/delivery-zone-actions.test.ts
git commit -m "feat: server actions for merchant delivery zone CRUD"
```

---

### Task 3: Painel do comerciante — aba "Entrega"

**Files:**
- Create: `src/components/merchant/DeliveryZoneManager.tsx`
- Create: `src/app/comerciante/entrega/page.tsx`
- Modify: `src/components/layout/DashboardShell.tsx`

**Interfaces:**
- Consumes: `getDeliveryZonesForOwner`, `getBusinessForOwner` de `src/lib/merchant.ts`; `upsertDeliveryZone`, `deleteDeliveryZone`, `toggleDeliveryZoneActive` de `src/actions/delivery-zone-actions.ts`; `centsToReais` de `src/lib/money.ts`.
- Produces: componente `DeliveryZoneManager({ zones }: { zones: { id: string; neighborhood: string; feeCents: number; active: boolean }[] })`.

- [ ] **Step 1: Criar `src/components/merchant/DeliveryZoneManager.tsx`**

Seguir exatamente a estrutura de `src/components/merchant/MenuManager.tsx` (form no topo + tabela abaixo), adaptado para os campos bairro/taxa/ativo:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertDeliveryZone, deleteDeliveryZone, toggleDeliveryZoneActive } from '@/actions/delivery-zone-actions'
import { centsToReais } from '@/lib/money'

type Zone = { id: string; neighborhood: string; feeCents: number; active: boolean }
type Values = { neighborhood: string; feeCents: string }
const EMPTY: Values = { neighborhood: '', feeCents: '' }

export function DeliveryZoneManager({ zones }: { zones: Zone[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [values, setValues] = useState<Values>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(zone: Zone) {
    setEditingId(zone.id)
    setError(null)
    setValues({ neighborhood: zone.neighborhood, feeCents: centsToReais(zone.feeCents) })
    setShowForm(true)
  }

  function startAdd() {
    setEditingId(null)
    setError(null)
    setValues(EMPTY)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await upsertDeliveryZone({ id: editingId ?? undefined, ...values })
      if (!result.ok) {
        setError(result.error)
        return
      }
      cancelForm()
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remover este bairro da lista de entrega?')) return
    await deleteDeliveryZone(id)
    router.refresh()
  }

  async function handleToggle(id: string, active: boolean) {
    await toggleDeliveryZoneActive(id, active)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Entrega</h1>
          <p className="text-sm text-neutral-500">
            Cadastre os bairros que você atende e o valor da taxa de entrega de cada um. Sem nenhum
            bairro cadastrado, a opção de entrega fica indisponível para o cliente.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={startAdd}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            + Novo bairro
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Bairro
            <input
              value={values.neighborhood}
              onChange={(e) => update('neighborhood', e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Taxa de entrega (R$)
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.feeCents}
              onChange={(e) => update('feeCents', e.target.value)}
              className={inputClass}
              required
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar bairro'}
            </button>
            <button type="button" onClick={cancelForm} className="text-sm font-bold text-neutral-500">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {zones.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum bairro cadastrado ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Bairro</th>
                <th className="px-4 py-2">Taxa</th>
                <th className="px-4 py-2">Ativo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{zone.neighborhood}</td>
                  <td className="px-4 py-3 text-neutral-600">R$ {centsToReais(zone.feeCents)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={zone.active}
                      onChange={(e) => handleToggle(zone.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => startEdit(zone)} className="text-xs font-bold text-brand-green">
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDelete(zone.id)} className="text-xs font-bold text-red-600">
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/comerciante/entrega/page.tsx`**

Seguir exatamente `src/app/comerciante/cardapio/page.tsx`:

```tsx
import { auth } from '@/lib/auth'
import { getBusinessForOwner, getDeliveryZonesForOwner } from '@/lib/merchant'
import { DeliveryZoneManager } from '@/components/merchant/DeliveryZoneManager'

export default async function ComercianteEntregaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const zones = await getDeliveryZonesForOwner(business.id)

  return <DeliveryZoneManager zones={zones} />
}
```

- [ ] **Step 3: Adicionar o item no menu lateral**

Em `src/components/layout/DashboardShell.tsx`, no array `comerciante`, adicionar a entrada logo depois de `{ href: '/comerciante/pedidos', label: 'Pedidos' }`:

```ts
    { href: '/comerciante/entrega', label: 'Entrega' },
```

- [ ] **Step 4: Verificar tipos e build**

```bash
npx tsc --noEmit
npm run build
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant/DeliveryZoneManager.tsx src/app/comerciante/entrega/page.tsx src/components/layout/DashboardShell.tsx
git commit -m "feat: merchant delivery zones tab"
```

---

### Task 4: `sendDeliveryZoneRequestEmail` + endpoint de interesse

**Files:**
- Modify: `src/lib/email.ts`
- Create: `src/app/api/mobile/entrega/interesse/route.ts`
- Create: `src/app/api/mobile/entrega/interesse/__tests__/interesse.test.ts`

**Interfaces:**
- Consumes: `requireMobileUser(request)` de `src/lib/mobile-session.ts`.
- Produces: `sendDeliveryZoneRequestEmail(to: string, data: { businessName: string; neighborhood: string }): Promise<void>` em `src/lib/email.ts`.
- Produces: `POST /api/mobile/entrega/interesse` — body `{ businessId: string; neighborhood: string }` → `{ ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Adicionar `sendDeliveryZoneRequestEmail` em `src/lib/email.ts`**

No final do arquivo, seguindo o padrão de `sendNewOrderEmail`:

```ts
export async function sendDeliveryZoneRequestEmail(
  to: string,
  data: { businessName: string; neighborhood: string },
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Aki Ofertas <pedidos@akiofertas.com.br>',
    to,
    subject: `Um cliente quer entrega em "${data.neighborhood}"`,
    html: `
      <p>Um cliente tentou pedir entrega para o bairro <strong>${data.neighborhood}</strong>, que ainda
      não está na sua lista de bairros atendidos em ${data.businessName}.</p>
      <p>Se quiser atender essa região, cadastre a taxa de entrega no painel:
      <a href="https://akiofertas.com.br/comerciante/entrega">akiofertas.com.br/comerciante/entrega</a>.</p>
    `,
  })
  if (error) {
    throw new Error(error.message)
  }
}
```

- [ ] **Step 2: Criar `src/app/api/mobile/entrega/interesse/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'
import { sendDeliveryZoneRequestEmail } from '@/lib/email'

const bodySchema = z.object({
  businessId: z.string().min(1),
  neighborhood: z.string().min(2),
})

export async function POST(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { id: parsed.data.businessId },
    select: { name: true, email: true, owner: { select: { email: true } } },
  })
  if (!business) {
    return NextResponse.json({ ok: false, error: 'Estabelecimento não encontrado.' }, { status: 404 })
  }

  const notifyEmail = business.email || business.owner.email
  if (notifyEmail) {
    sendDeliveryZoneRequestEmail(notifyEmail, {
      businessName: business.name,
      neighborhood: parsed.data.neighborhood,
    }).catch((err) => console.error('Failed to send delivery zone request email', err))
  }

  return NextResponse.json({ ok: true })
}
```

Nota: como no restante da API mobile, o disparo de e-mail não bloqueia a resposta (mesmo padrão fire-and-forget de `createOrderForUser`) — o cliente vê sucesso assim que a validação passa, sem esperar o Resend.

- [ ] **Step 3: Testes em `src/app/api/mobile/entrega/interesse/__tests__/interesse.test.ts`**

Seguir o estilo de `src/app/api/mobile/pedidos/__tests__/pedidos.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from '@/app/api/mobile/entrega/interesse/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { prisma } from '@/lib/db'
import { sendDeliveryZoneRequestEmail } from '@/lib/email'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { business: { findUnique: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendDeliveryZoneRequestEmail: vi.fn().mockResolvedValue(undefined) }))

function postRequest(body: unknown) {
  return new Request('https://example.com/api/mobile/entrega/interesse', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validBody = { businessId: 'biz-1', neighborhood: 'Vila Nova' }

describe('POST /api/mobile/entrega/interesse', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(401)
  })

  it('rejects invalid input', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await POST(postRequest({ businessId: 'biz-1', neighborhood: 'X' }))
    expect(response.status).toBe(400)
  })

  it('returns 404 when the business does not exist', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const response = await POST(postRequest(validBody))
    expect(response.status).toBe(404)
  })

  it('sends the request email to the business email when present', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      name: 'Big Burger',
      email: 'contato@bigburger.com',
      owner: { email: 'dono@bigburger.com' },
    } as never)

    const response = await POST(postRequest(validBody))

    expect(response.status).toBe(200)
    expect(sendDeliveryZoneRequestEmail).toHaveBeenCalledWith('contato@bigburger.com', {
      businessName: 'Big Burger',
      neighborhood: 'Vila Nova',
    })
  })

  it('falls back to the owner email when the business has none', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      name: 'Big Burger',
      email: null,
      owner: { email: 'dono@bigburger.com' },
    } as never)

    await POST(postRequest(validBody))

    expect(sendDeliveryZoneRequestEmail).toHaveBeenCalledWith('dono@bigburger.com', expect.anything())
  })
})
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/app/api/mobile/entrega/interesse/__tests__/interesse.test.ts
```
Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/app/api/mobile/entrega
git commit -m "feat: delivery zone interest notification email + endpoint"
```

---

### Task 5: `lib/offers.ts` expõe `deliveryZones` e `business.id` na oferta

**Files:**
- Modify: `src/lib/offers.ts`
- Modify: `src/lib/__tests__/offers.test.ts` (se já cobrir `getOfferBySlug`; senão criar o caso ali)

**Interfaces:**
- Produces: `OfferDetail.business.id: string` (novo campo).
- Produces: `OfferDetail.deliveryZones: { id: string; neighborhood: string; feeCents: number }[]` (só zonas `active: true`, ordenadas por `neighborhood`).

- [ ] **Step 1: Atualizar o tipo `OfferDetail` em `src/lib/offers.ts`**

```ts
export type OfferDetail = {
  id: string
  slug: string
  title: string
  description: string | null
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  quantityAvailable: number | null
  startDate: Date
  endDate: Date
  deliveryEnabled: boolean
  deliveryZones: { id: string; neighborhood: string; feeCents: number }[]
  business: {
    id: string
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
  }
}
```

- [ ] **Step 2: Atualizar `getOfferBySlug` para buscar e mapear as zonas**

Trocar o `include` da query e o retorno:

```ts
export async function getOfferBySlug(slug: string): Promise<OfferDetail | null> {
  const row = await prisma.offer.findUnique({
    where: { slug },
    include: {
      business: {
        include: {
          owner: { select: { blocked: true } },
          deliveryZones: { where: { active: true }, orderBy: { neighborhood: 'asc' } },
        },
      },
    },
  })

  if (!row) return null
  if (row.business.status !== 'ACTIVE' || row.business.owner.blocked) return null

  const now = new Date()
  if (row.startDate > now || row.endDate < now) return null

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    originalPrice: row.originalPrice,
    discountPrice: row.discountPrice,
    discountPercent: row.discountPercent,
    quantityAvailable: row.quantityAvailable,
    startDate: row.startDate,
    endDate: row.endDate,
    deliveryEnabled: row.deliveryEnabled,
    deliveryZones: row.business.deliveryZones.map((zone) => ({
      id: zone.id,
      neighborhood: zone.neighborhood,
      feeCents: zone.feeCents,
    })),
    business: {
      id: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
      whatsapp: row.business.whatsapp,
      city: row.business.city,
      state: row.business.state,
    },
  }
}
```

Nota: `include: { business: { include: { deliveryZones: {...} } } }` substitui o `include: { business: { include: { owner: ... } } }` anterior — a chave `owner` continua dentro do `include` do `business`, junto de `deliveryZones`, ambos como propriedades irmãs do `include` aninhado.

- [ ] **Step 3: Ajustar/criar o teste de `getOfferBySlug`**

Abrir `src/lib/__tests__/offers.test.ts`, localizar o mock de `prisma.offer.findUnique` usado para `getOfferBySlug` e adicionar `deliveryZones` no fixture do `business` mockado (lista vazia no caso base, e um caso novo com zonas):

```ts
it('includes only active delivery zones, mapped to id/neighborhood/feeCents', async () => {
  vi.mocked(prisma.offer.findUnique).mockResolvedValue({
    // ...demais campos do fixture existente da oferta ativa...
    business: {
      // ...demais campos do fixture existente do business...
      id: 'biz-1',
      deliveryZones: [{ id: 'zone-1', neighborhood: 'Centro', feeCents: 500, active: true }],
    },
  } as never)

  const result = await getOfferBySlug('combo-burguer')

  expect(result?.deliveryZones).toEqual([{ id: 'zone-1', neighborhood: 'Centro', feeCents: 500 }])
  expect(result?.business.id).toBe('biz-1')
})
```

(Ler o arquivo antes de editar para casar exatamente com o fixture existente da oferta ativa — não recriar os outros campos do zero.)

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/offers.test.ts
```
Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offers.ts src/lib/__tests__/offers.test.ts
git commit -m "feat: expose active delivery zones and business id on offer detail"
```

---

### Task 6: `createOrderForUser` passa a exigir `deliveryZoneId`

**Files:**
- Modify: `src/lib/orders.ts`
- Modify: `src/lib/__tests__/orders.test.ts`
- Modify: `src/app/api/mobile/pedidos/route.ts`
- Modify: `src/app/api/mobile/pedidos/__tests__/pedidos.test.ts`

**Interfaces:**
- Consumes: nada novo — usa `prisma.deliveryZone.findFirst`.
- Produces: `CreateOrderInput` troca `neighborhood?: string` por `deliveryZoneId: string`.
- Produces: novo erro `'Bairro inválido ou indisponível.'`.

- [ ] **Step 1: Atualizar `CreateOrderInput` e `createOrderForUser` em `src/lib/orders.ts`**

```ts
export type CreateOrderInput = {
  offerId: string
  quantity: number
  phone: string
  address: string
  number?: string
  deliveryZoneId: string
  city: string
  state: string
  zip?: string
  notes?: string
}
```

Adicionar a constante de erro e a validação da zona logo após a checagem `deliveryEnabled` existente:

```ts
const ZONE_NOT_AVAILABLE = 'Bairro inválido ou indisponível.'
```

```ts
  if (!offer.deliveryEnabled) {
    return { ok: false, error: DELIVERY_NOT_AVAILABLE }
  }

  const zone = await prisma.deliveryZone.findFirst({
    where: { id: input.deliveryZoneId, businessId: offer.business.id, active: true },
  })
  if (!zone) {
    return { ok: false, error: ZONE_NOT_AVAILABLE }
  }

  const now = new Date()
```

E no `prisma.order.create`, trocar `neighborhood: input.neighborhood || null` por:

```ts
      neighborhood: zone.neighborhood,
      deliveryFeeCents: zone.feeCents,
```

- [ ] **Step 2: Atualizar os testes existentes em `src/lib/__tests__/orders.test.ts`**

No mock de `prisma` (linha ~14), adicionar `deliveryZone: { findFirst: vi.fn() }`.

Trocar `validInput` para incluir `deliveryZoneId` no lugar de nada de bairro:

```ts
const validInput = {
  offerId: 'offer-1',
  quantity: 2,
  phone: '5546999990000',
  address: 'Rua das Flores, 10',
  deliveryZoneId: 'zone-1',
  city: 'Marmeleiro',
  state: 'pr',
}
```

Em cada teste que chega até a criação do pedido (o teste `'creates the order...'` e os dois de e-mail), adicionar antes da chamada:

```ts
vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({
  id: 'zone-1',
  neighborhood: 'Centro',
  feeCents: 500,
} as never)
```

E atualizar o `expect(prisma.order.create).toHaveBeenCalledWith(...)` do teste `'creates the order, uppercasing the state'`: remover `number: null, neighborhood: null` do bloco `data` original e usar:

```ts
      data: {
        userId: 'user-1',
        offerId: 'offer-1',
        businessId: 'biz-1',
        quantity: 2,
        phone: '5546999990000',
        address: 'Rua das Flores, 10',
        number: null,
        neighborhood: 'Centro',
        deliveryFeeCents: 500,
        city: 'Marmeleiro',
        state: 'PR',
        zip: null,
        notes: null,
      },
```

Adicionar um novo teste para a zona inválida:

```ts
it('rejects when the delivery zone is not found or inactive for this business', async () => {
  vi.mocked(prisma.offer.findUnique).mockResolvedValue(activeOffer as never)
  vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue(null)

  const result = await createOrderForUser('user-1', validInput)
  expect(result).toEqual({ ok: false, error: 'Bairro inválido ou indisponível.' })
  expect(prisma.order.create).not.toHaveBeenCalled()
})
```

Também atualizar o fixture `orderRowFixture`/expectativas de `getOrdersForUser` se elas afirmarem `neighborhood: null` explicitamente — adicionar `deliveryFeeCents` ao tipo `OrderRow`/fixture como campo opcional consistente (ver Step 3 abaixo antes de tocar aqui).

- [ ] **Step 3: Expor `deliveryFeeCents` em `OrderRow`**

Em `src/lib/orders.ts`, adicionar `deliveryFeeCents: number | null` ao tipo `OrderRow`, ao parâmetro de `toOrderRow`, e ao retorno de `toOrderRow` (`deliveryFeeCents: row.deliveryFeeCents`). Atualizar `orderRowFixture` e a expectativa de `getOrdersForUser`/`getOrdersForBusiness` em `orders.test.ts` para incluir esse campo (ex.: `deliveryFeeCents: 500` no fixture e na expectativa).

- [ ] **Step 4: Atualizar a rota `src/app/api/mobile/pedidos/route.ts`**

Trocar no `bodySchema`:

```ts
const bodySchema = z.object({
  offerId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  phone: z.string().min(8),
  address: z.string().min(3),
  number: z.string().optional(),
  deliveryZoneId: z.string().min(1),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().optional(),
  notes: z.string().optional(),
})
```

- [ ] **Step 5: Atualizar `src/app/api/mobile/pedidos/__tests__/pedidos.test.ts`**

Trocar `validBody` para incluir `deliveryZoneId: 'zone-1'` no lugar de nada de bairro; os testes que passam `createOrderForUser` já checam `toHaveBeenCalledWith('user-1', validBody)`, então o novo campo passa a valer automaticamente.

- [ ] **Step 6: Rodar todos os testes afetados**

```bash
npx vitest run src/lib/__tests__/orders.test.ts src/app/api/mobile/pedidos/__tests__/pedidos.test.ts
```
Esperado: todos passando.

- [ ] **Step 7: Commit**

```bash
git add src/lib/orders.ts src/lib/__tests__/orders.test.ts src/app/api/mobile/pedidos
git commit -m "feat: require a valid delivery zone when creating a delivery order"
```

---

### Task 7: App mobile — tipos e hook de interesse

**Files:**
- Modify: `app-mobile/src/api/types.ts`
- Create: `app-mobile/src/api/hooks/useDeliveryInterest.ts`

**Interfaces:**
- Produces: `OfferDetail.deliveryZones: { id: string; neighborhood: string; feeCents: number }[]`, `OfferDetail.business.id: string`.
- Produces: `CreateOrderInput` troca `neighborhood?: string` por `deliveryZoneId: string`.
- Produces: `useDeliveryInterest(): { mutateAsync: (input: { businessId: string; neighborhood: string }) => Promise<{ ok: true }> , isPending: boolean }` (via `useMutation`).

- [ ] **Step 1: Atualizar `app-mobile/src/api/types.ts`**

No tipo `OfferDetail`, adicionar `deliveryZones` e `business.id`:

```ts
export type OfferDetail = {
  id: string
  slug: string
  title: string
  description: string | null
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  quantityAvailable: number | null
  startDate: string
  endDate: string
  deliveryEnabled: boolean
  deliveryZones: { id: string; neighborhood: string; feeCents: number }[]
  business: {
    id: string
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
  }
}
```

No tipo `CreateOrderInput`, trocar `neighborhood?: string` por `deliveryZoneId: string`:

```ts
export type CreateOrderInput = {
  offerId: string
  quantity: number
  phone: string
  address: string
  number?: string
  deliveryZoneId: string
  city: string
  state: string
  zip?: string
  notes?: string
}
```

- [ ] **Step 2: Criar `app-mobile/src/api/hooks/useDeliveryInterest.ts`**

Seguir o padrão de `useCreateOrder` em `app-mobile/src/api/hooks/useOrders.ts`:

```ts
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'

export function useDeliveryInterest() {
  const { authedFetch } = useAuth()

  return useMutation({
    mutationFn: (input: { businessId: string; neighborhood: string }) =>
      authedFetch<{ ok: true }>('/entrega/interesse', { method: 'POST', body: input }),
  })
}
```

- [ ] **Step 3: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```
Esperado: sem erros (o passo seguinte, Task 8, é quem consome os campos novos nas telas — nesse ponto o `tsc` só valida que os tipos em si são consistentes).

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/api/types.ts app-mobile/src/api/hooks/useDeliveryInterest.ts
git commit -m "feat(mobile): delivery zone types and interest-notification hook"
```

---

### Task 8: App mobile — botão de entrega condicionado a ter zona cadastrada

**Files:**
- Modify: `app-mobile/app/oferta/[slug].tsx`

**Interfaces:**
- Consumes: `offer.deliveryEnabled: boolean`, `offer.deliveryZones: { id, neighborhood, feeCents }[]` (de `OfferDetail`, Task 7).

- [ ] **Step 1: Ajustar a condição do botão "Pedir com entrega"**

Em `app-mobile/app/oferta/[slug].tsx`, linha 73, trocar:

```tsx
          {offer.deliveryEnabled && (
```

por:

```tsx
          {offer.deliveryEnabled && offer.deliveryZones.length > 0 && (
```

- [ ] **Step 2: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app-mobile/app/oferta/\[slug\].tsx
git commit -m "feat(mobile): hide delivery button when the business has no delivery zones"
```

---

### Task 9: App mobile — tela de pedido com seleção de bairro e taxa

**Files:**
- Modify: `app-mobile/app/pedido/[slug].tsx`
- Create: `app-mobile/src/utils/__tests__/orderTotal.test.ts`
- Modify: `app-mobile/src/utils/money.ts` (ou criar `app-mobile/src/utils/orderTotal.ts`, ver Step 1)

**Interfaces:**
- Produces: `calculateOrderTotal(subtotalCents: number, feeCents: number | null): number` — função pura, exportada e testável isoladamente.
- Consumes: `useDeliveryInterest()` (Task 7), `offer.deliveryZones` (Task 7).

- [ ] **Step 1: Extrair `calculateOrderTotal` em `app-mobile/src/utils/orderTotal.ts`**

Novo arquivo — soma simples, mas extraída como função pura para ter cobertura de teste (o app mobile não testa componentes, só lógica pura — ver Global Constraints):

```ts
export function calculateOrderTotal(subtotalCents: number, feeCents: number | null): number {
  return subtotalCents + (feeCents ?? 0)
}
```

- [ ] **Step 2: Testar em `app-mobile/src/utils/__tests__/orderTotal.test.ts`**

```ts
import { describe, expect, it } from '@jest/globals'
import { calculateOrderTotal } from '@/utils/orderTotal'

describe('calculateOrderTotal', () => {
  it('adds the delivery fee to the subtotal', () => {
    expect(calculateOrderTotal(9990, 500)).toBe(10490)
  })

  it('treats a null fee as zero', () => {
    expect(calculateOrderTotal(9990, null)).toBe(9990)
  })
})
```

Rodar:
```bash
cd app-mobile && npx jest src/utils/__tests__/orderTotal.test.ts
```
Esperado: passando.

- [ ] **Step 3: Reescrever `app-mobile/app/pedido/[slug].tsx`**

Substituir o arquivo inteiro por (mantém tudo que já existe — quantidade, telefone, endereço, número, cidade, UF, observações — e troca só o bloco de bairro/total):

```tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { calculateOrderTotal } from '@/utils/orderTotal'
import { useOfferDetail } from '@/api/hooks/useOfferDetail'
import { useCreateOrder } from '@/api/hooks/useOrders'
import { useDeliveryInterest } from '@/api/hooks/useDeliveryInterest'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/api/client'

const OTHER_NEIGHBORHOOD = '__other__'

export default function PedidoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { token } = useAuth()
  const { data: offer, isLoading } = useOfferDetail(slug)
  const createOrder = useCreateOrder()
  const deliveryInterest = useDeliveryInterest()

  const [quantity, setQuantity] = useState(1)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [number, setNumber] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [otherNeighborhood, setOtherNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [interestSent, setInterestSent] = useState(false)

  if (!token) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Pedir com entrega' }} />
        <Text style={styles.emptyTitle}>Entre para fazer um pedido</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/entrar')}>
          <Text style={styles.primaryButtonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  if (isLoading || !offer) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Pedir com entrega' }} />
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  const selectedZone = offer.deliveryZones.find((z) => z.id === selectedZoneId) ?? null
  const choosingOther = selectedZoneId === OTHER_NEIGHBORHOOD

  async function handleSubmit() {
    if (!selectedZone) return
    setError(null)
    try {
      await createOrder.mutateAsync({
        offerId: offer!.id,
        quantity,
        phone,
        address,
        number: number || undefined,
        deliveryZoneId: selectedZone.id,
        city,
        state,
        notes: notes || undefined,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido.')
    }
  }

  async function handleNotifyInterest() {
    if (!otherNeighborhood.trim()) return
    try {
      await deliveryInterest.mutateAsync({ businessId: offer!.business.id, neighborhood: otherNeighborhood.trim() })
      setInterestSent(true)
    } catch {
      setError('Não foi possível enviar o aviso. Tente novamente.')
    }
  }

  if (success) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Pedido enviado' }} />
        <Text style={styles.emptyTitle}>Pedido enviado! 🎉</Text>
        <Text style={styles.successText}>{offer.business.name} vai confirmar seu pedido em breve.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </Pressable>
      </View>
    )
  }

  const subtotal = offer.discountPrice * quantity
  const total = calculateOrderTotal(subtotal, selectedZone?.feeCents ?? null)
  const canSubmit = !createOrder.isPending && phone && address && city && state.length === 2 && !!selectedZone

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Pedir com entrega' }} />
      <Text style={styles.title}>{offer.title}</Text>
      <Text style={styles.business}>{offer.business.name}</Text>

      <View style={styles.quantityRow}>
        <Text style={styles.label}>Quantidade</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{quantity}</Text>
          <Pressable style={styles.stepperButton} onPress={() => setQuantity((q) => q + 1)}>
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Endereço de entrega</Text>
      <TextInput style={styles.input} placeholder="Telefone (com DDD)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Endereço" value={address} onChangeText={setAddress} />
      <TextInput style={styles.input} placeholder="Número" value={number} onChangeText={setNumber} />

      <Text style={styles.label}>Bairro</Text>
      <View style={styles.zoneList}>
        {offer.deliveryZones.map((zone) => (
          <Pressable
            key={zone.id}
            style={[styles.zoneOption, selectedZoneId === zone.id && styles.zoneOptionSelected]}
            onPress={() => setSelectedZoneId(zone.id)}
          >
            <Text style={[styles.zoneOptionText, selectedZoneId === zone.id && styles.zoneOptionTextSelected]}>
              {zone.neighborhood} — {formatCents(zone.feeCents)}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.zoneOption, choosingOther && styles.zoneOptionSelected]}
          onPress={() => setSelectedZoneId(OTHER_NEIGHBORHOOD)}
        >
          <Text style={[styles.zoneOptionText, choosingOther && styles.zoneOptionTextSelected]}>
            Meu bairro não está nessa lista
          </Text>
        </Pressable>
      </View>

      {choosingOther && (
        <View style={styles.otherBox}>
          {interestSent ? (
            <Text style={styles.successText}>Aviso enviado! Você pode retirar no local usando o cupom.</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nome do seu bairro"
                value={otherNeighborhood}
                onChangeText={setOtherNeighborhood}
              />
              <Text style={styles.otherWarning}>Ainda não fazemos entrega nesse bairro.</Text>
              <Pressable
                style={styles.secondaryButtonFull}
                onPress={handleNotifyInterest}
                disabled={deliveryInterest.isPending || !otherNeighborhood.trim()}
              >
                <Text style={styles.secondaryButtonFullText}>
                  {deliveryInterest.isPending ? 'Enviando...' : 'Avisar o estabelecimento'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex2]} placeholder="Cidade" value={city} onChangeText={setCity} />
        <TextInput
          style={[styles.input, styles.flex1]}
          placeholder="UF"
          value={state}
          onChangeText={setState}
          autoCapitalize="characters"
          maxLength={2}
        />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Observações (opcional)"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCents(total)}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={!canSubmit}>
        {createOrder.isPending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Confirmar pedido</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: colors.neutral900 },
  business: { fontSize: 13, color: colors.neutral500, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900, textAlign: 'center' },
  successText: { fontSize: 13, color: colors.neutral500, textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.neutral900, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.neutral900 },
  quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 18, fontWeight: '700', color: colors.neutral900 },
  stepperValue: { fontSize: 15, fontWeight: '700', color: colors.neutral900, minWidth: 20, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  input: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  zoneList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneOption: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  zoneOptionSelected: { borderColor: colors.green, backgroundColor: colors.green },
  zoneOptionText: { fontSize: 13, fontWeight: '600', color: colors.neutral900 },
  zoneOptionTextSelected: { color: colors.white },
  otherBox: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.neutral100 },
  otherWarning: { fontSize: 13, color: colors.red, fontWeight: '600' },
  secondaryButtonFull: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonFullText: { color: colors.green, fontWeight: '700', fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  totalLabel: { fontSize: 14, color: colors.neutral500 },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.green },
  error: { color: colors.red, fontSize: 13, textAlign: 'center' },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
})
```

Antes de aplicar, ler o arquivo atual (`app-mobile/app/pedido/[slug].tsx`) para conferir que `colors` tem `red`/`green`/`neutral100`/`neutral200`/`neutral900`/`neutral500`/`white` (já usados no arquivo original) — não introduzir nenhum token de cor novo.

- [ ] **Step 4: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app-mobile/app/pedido/\[slug\].tsx app-mobile/src/utils/orderTotal.ts app-mobile/src/utils/__tests__/orderTotal.test.ts
git commit -m "feat(mobile): pick delivery neighborhood from merchant list, add fee to total"
```

---

### Task 10: Build final, testes completos e deploy

**Files:** nenhum novo — apenas execução e verificação.

- [ ] **Step 1: Testes e tipos do site**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Esperado: tudo passando/sem erros.

- [ ] **Step 2: Testes e tipos do app mobile**

```bash
cd app-mobile
npx tsc --noEmit
npx jest
```
Esperado: tudo passando/sem erros.

- [ ] **Step 3: Rebuild do export web do app mobile e sync**

```bash
cd app-mobile
npx expo export --platform web --clear
```
Copiar o conteúdo de `app-mobile/dist/` para `public/app/` (mesmo processo já usado nas features anteriores desta sessão).

- [ ] **Step 4: Rodar os testes do site de novo (pós-sync) e build final**

```bash
npx vitest run
npm run build
```

- [ ] **Step 5: Aplicar a migration em produção**

```bash
npx prisma migrate deploy
```
(ou o comando equivalente já usado neste projeto para aplicar migrations no banco de produção antes do deploy do código — conferir `package.json`/histórico se houver um script dedicado.)

- [ ] **Step 6: Deploy**

```bash
npx vercel --prod
```
Se falhar com o erro transitório `"Not authorized"` (já visto antes nesta sessão), rodar `npx vercel link --yes` e tentar de novo.

- [ ] **Step 7: Verificação manual em produção**

Usando o navegador: logar como o comerciante de teste, abrir `/comerciante/entrega`, cadastrar 1-2 bairros com taxa; abrir o app mobile (`/app`), entrar como cliente, abrir uma oferta com `deliveryEnabled`, confirmar que o botão de entrega aparece, escolher um bairro, conferir que o total soma a taxa, e testar a opção "Meu bairro não está na lista" (mensagem correta, sem criar pedido).

- [ ] **Step 8: Commit final (se sobrar algo do sync do export)**

```bash
git add public/app
git commit -m "chore: sync mobile web export with delivery zone changes"
```
