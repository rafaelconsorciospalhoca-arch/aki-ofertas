# Histórico de Cupons e Relatórios do Comerciante Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao comerciante uma aba "Relatórios" no painel com o histórico completo de cupons (código, oferta, cliente, status, datas) e um resumo agregado por oferta (gerados x usados x conversão).

**Architecture:** Duas novas funções somente-leitura em `src/lib/coupons.ts` (uma listando cupons por negócio, outra agregando por oferta via `groupBy`). Uma página nova no painel do comerciante (`src/app/comerciante/relatorios/page.tsx`) com um componente de exibição (`src/components/merchant/ReportsView.tsx`), seguindo o padrão de tabela já usado em `MenuManager`/`OrderManager`. Nenhuma mudança de schema, nenhuma mudança no app mobile.

**Tech Stack:** Next.js 14 (App Router, Server Components), Prisma/Postgres, Vitest.

## Global Constraints

- Disponível para **todo** comerciante, sem trava de plano (`hasFullMetrics` não é usado nesta feature — decisão explícita do design, não pendência).
- Sem paginação nem filtro de data nesta versão — mesma escolha das listas existentes (`OrderManager`, `MenuManager`).
- `getCouponsForBusiness`/`getCouponStatsForBusiness` são funções de leitura simples (não `'use server'`) — seguem o padrão de `src/lib/merchant.ts`/`src/lib/coupons.ts` já existente: autorização é responsabilidade do caller (a página resolve `business.id` a partir da sessão autenticada, como já faz `cardapio/page.tsx`/`entrega/page.tsx`).
- Nenhuma mudança em `prisma/schema.prisma` — os dados já existem no modelo `Coupon`.

---

### Task 1: Dados — `getCouponsForBusiness` e `getCouponStatsForBusiness`

**Files:**
- Modify: `src/lib/coupons.ts`
- Modify: `src/lib/__tests__/coupons.test.ts`

**Interfaces:**
- Produces: `export type MerchantCouponRow = CouponRow & { customerName: string }`
- Produces: `export async function getCouponsForBusiness(businessId: string): Promise<MerchantCouponRow[]>`
- Produces: `export type OfferCouponStats = { offerId: string; offerTitle: string; generated: number; used: number }`
- Produces: `export async function getCouponStatsForBusiness(businessId: string): Promise<OfferCouponStats[]>`

- [ ] **Step 1: Ler o arquivo atual antes de editar**

Abrir `src/lib/coupons.ts` por inteiro — o `CouponWithRelations`, `couponInclude`, e `toCouponRow` já existentes (linhas 1-54 na versão atual) serão reaproveitados, não duplicados.

- [ ] **Step 2: Adicionar `getCouponsForBusiness`**

Logo após `getCouponsForUser` (que já existe), adicionar:

```ts
export type MerchantCouponRow = CouponRow & { customerName: string }

const merchantCouponInclude = {
  ...couponInclude,
  user: { select: { name: true } },
} as const

export async function getCouponsForBusiness(businessId: string): Promise<MerchantCouponRow[]> {
  const rows = await prisma.coupon.findMany({
    where: { businessId },
    include: merchantCouponInclude,
    orderBy: { generatedAt: 'desc' },
  })

  return rows.map((row) => ({ ...toCouponRow(row), customerName: row.user.name }))
}
```

Nota: `toCouponRow` já aceita qualquer objeto com o shape de `CouponWithRelations` — como `merchantCouponInclude` inclui todos os mesmos campos de `couponInclude` mais `user`, o `row` retornado por essa query satisfaz `CouponWithRelations` estruturalmente (TypeScript aceita o campo extra `user` sem problema).

- [ ] **Step 3: Adicionar `getCouponStatsForBusiness`**

No final do arquivo:

```ts
export type OfferCouponStats = {
  offerId: string
  offerTitle: string
  generated: number
  used: number
}

export async function getCouponStatsForBusiness(businessId: string): Promise<OfferCouponStats[]> {
  const rows = await prisma.coupon.groupBy({
    by: ['offerId', 'status'],
    where: { businessId },
    _count: true,
  })

  if (rows.length === 0) return []

  const offerIds = [...new Set(rows.map((row) => row.offerId))]
  const offers = await prisma.offer.findMany({
    where: { id: { in: offerIds } },
    select: { id: true, title: true },
  })
  const titleById = new Map(offers.map((offer) => [offer.id, offer.title]))

  const statsByOffer = new Map<string, { generated: number; used: number }>()
  for (const row of rows) {
    const entry = statsByOffer.get(row.offerId) ?? { generated: 0, used: 0 }
    entry.generated += row._count
    if (row.status === 'USED') entry.used += row._count
    statsByOffer.set(row.offerId, entry)
  }

  return [...statsByOffer.entries()]
    .map(([offerId, stats]) => ({
      offerId,
      offerTitle: titleById.get(offerId) ?? '—',
      generated: stats.generated,
      used: stats.used,
    }))
    .sort((a, b) => b.generated - a.generated)
}
```

- [ ] **Step 4: Testes em `src/lib/__tests__/coupons.test.ts`**

Ler o arquivo atual primeiro (já usa `vi.mock('@/lib/db', ...)` com `coupon: { findMany, findFirst, count }` e um helper `couponRow(overrides)` — ver o trecho já existente reproduzido abaixo para referência exata):

```ts
vi.mock('@/lib/db', () => ({
  prisma: {
    coupon: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  },
}))

const now = new Date('2026-06-15T12:00:00Z')

function couponRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'coupon-1',
    code: 'AK7X9K2',
    status: 'GENERATED',
    generatedAt: new Date('2026-06-01'),
    usedAt: null,
    expiresAt: new Date('2026-07-01'),
    offerId: 'offer-1',
    offer: { title: 'Combo Burguer', slug: 'combo-burguer', customCouponCode: null },
    business: { name: 'Big Burger', slug: 'big-burger' },
    ...overrides,
  }
}
```

Adicionar `groupBy: vi.fn()` ao mock de `prisma.coupon` e `offer: { findMany: vi.fn() }` ao mock de `prisma` no topo do arquivo (o mock hoje só tem `coupon: {...}` — adicionar a chave `offer` como irmã de `coupon`).

Importar `getCouponsForBusiness` e `getCouponStatsForBusiness` no topo junto com os imports já existentes.

Novos testes:

```ts
describe('getCouponsForBusiness', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('returns an empty list when the business has no coupons', async () => {
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([])
    const result = await getCouponsForBusiness('biz-1')
    expect(result).toEqual([])
  })

  it('maps coupon rows scoped to the business, including the customer name', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.mocked(prisma.coupon.findMany).mockResolvedValue([
      { ...couponRow(), user: { name: 'Maria' } },
    ] as never)

    const result = await getCouponsForBusiness('biz-1')

    expect(result).toEqual([
      {
        id: 'coupon-1',
        code: 'AK7X9K2',
        status: 'VALID',
        generatedAt: new Date('2026-06-01'),
        usedAt: null,
        expiresAt: new Date('2026-07-01'),
        offerId: 'offer-1',
        offerTitle: 'Combo Burguer',
        offerSlug: 'combo-burguer',
        businessName: 'Big Burger',
        businessSlug: 'big-burger',
        customerName: 'Maria',
      },
    ])
    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'biz-1' } }),
    )
  })
})

describe('getCouponStatsForBusiness', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns an empty list when the business has no coupons', async () => {
    vi.mocked(prisma.coupon.groupBy).mockResolvedValue([])
    const result = await getCouponStatsForBusiness('biz-1')
    expect(result).toEqual([])
    expect(prisma.offer.findMany).not.toHaveBeenCalled()
  })

  it('aggregates generated and used counts per offer, sorted by generated desc', async () => {
    vi.mocked(prisma.coupon.groupBy).mockResolvedValue([
      { offerId: 'offer-1', status: 'GENERATED', _count: 3 },
      { offerId: 'offer-1', status: 'USED', _count: 2 },
      { offerId: 'offer-2', status: 'USED', _count: 1 },
    ] as never)
    vi.mocked(prisma.offer.findMany).mockResolvedValue([
      { id: 'offer-1', title: 'Combo Burguer' },
      { id: 'offer-2', title: 'Sobremesa Grátis' },
    ] as never)

    const result = await getCouponStatsForBusiness('biz-1')

    expect(result).toEqual([
      { offerId: 'offer-1', offerTitle: 'Combo Burguer', generated: 5, used: 2 },
      { offerId: 'offer-2', offerTitle: 'Sobremesa Grátis', generated: 1, used: 1 },
    ])
  })
})
```

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/coupons.test.ts
```
Esperado: todos passando (os testes já existentes de `getCouponsForUser`/`getCouponForOffer`/`getCouponsCountForOffer` continuam passando sem alteração).

- [ ] **Step 6: Commit**

```bash
git add src/lib/coupons.ts src/lib/__tests__/coupons.test.ts
git commit -m "feat: coupon history and per-offer stats for merchants"
```

---

### Task 2: Painel do comerciante — aba "Relatórios"

**Files:**
- Create: `src/components/merchant/ReportsView.tsx`
- Create: `src/app/comerciante/relatorios/page.tsx`
- Modify: `src/components/layout/DashboardShell.tsx`

**Interfaces:**
- Consumes: `getCouponsForBusiness`, `getCouponStatsForBusiness` de `src/lib/coupons.ts` (Task 1); `getBusinessForOwner` de `src/lib/merchant.ts`; `auth` de `src/lib/auth`.
- Produces: `ReportsView({ stats, coupons }: { stats: OfferCouponStats[]; coupons: MerchantCouponRow[] })`.

- [ ] **Step 1: Criar `src/components/merchant/ReportsView.tsx`**

Componente puramente de exibição (sem formulário, sem `'use client'` — não há interatividade), seguindo o padrão visual de tabela de `MenuManager.tsx`/`OrderManager.tsx`:

```tsx
import type { OfferCouponStats, MerchantCouponRow } from '@/lib/coupons'

const STATUS_LABEL: Record<MerchantCouponRow['status'], string> = {
  VALID: 'Válido',
  USED: 'Usado',
  EXPIRED: 'Expirado',
}

const STATUS_COLOR: Record<MerchantCouponRow['status'], string> = {
  VALID: 'bg-emerald-100 text-emerald-700',
  USED: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function conversionLabel(generated: number, used: number): string {
  if (generated === 0) return '—'
  return `${Math.round((used / generated) * 100)}%`
}

export function ReportsView({ stats, coupons }: { stats: OfferCouponStats[]; coupons: MerchantCouponRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Relatórios</h1>
        <p className="text-sm text-neutral-500">Acompanhe o desempenho dos seus cupons.</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-neutral-900">Resumo por oferta</h2>
        {stats.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum cupom gerado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Oferta</th>
                  <th className="px-4 py-2">Gerados</th>
                  <th className="px-4 py-2">Usados</th>
                  <th className="px-4 py-2">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.offerId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">{row.offerTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.generated}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.used}</td>
                    <td className="px-4 py-3 text-neutral-600">{conversionLabel(row.generated, row.used)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-neutral-900">Histórico de cupons</h2>
        {coupons.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum cupom gerado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Oferta</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Gerado em</th>
                  <th className="px-4 py-2">Usado em</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-900">{coupon.code}</td>
                    <td className="px-4 py-3 text-neutral-600">{coupon.offerTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{coupon.customerName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[coupon.status]}`}>
                        {STATUS_LABEL[coupon.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{formatDate(coupon.generatedAt)}</td>
                    <td className="px-4 py-3 text-neutral-600">{coupon.usedAt ? formatDate(coupon.usedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/comerciante/relatorios/page.tsx`**

Seguindo exatamente o padrão de `src/app/comerciante/entrega/page.tsx` (ler esse arquivo antes, se precisar de referência exata):

```tsx
import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { getCouponsForBusiness, getCouponStatsForBusiness } from '@/lib/coupons'
import { ReportsView } from '@/components/merchant/ReportsView'

export default async function ComercianteRelatoriosPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const [stats, coupons] = await Promise.all([
    getCouponStatsForBusiness(business.id),
    getCouponsForBusiness(business.id),
  ])

  return <ReportsView stats={stats} coupons={coupons} />
}
```

- [ ] **Step 3: Adicionar o item no menu lateral**

Em `src/components/layout/DashboardShell.tsx`, no array `comerciante`, adicionar a entrada logo depois de `{ href: '/comerciante/entrega', label: 'Entrega' }` (essa entrada já existe, de uma feature anterior):

```ts
    { href: '/comerciante/relatorios', label: 'Relatórios' },
```

- [ ] **Step 4: Verificar tipos e build**

```bash
npx tsc --noEmit
npm run build
```
Esperado: sem erros, rota `/comerciante/relatorios` aparece na saída do build.

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant/ReportsView.tsx src/app/comerciante/relatorios/page.tsx src/components/layout/DashboardShell.tsx
git commit -m "feat: merchant reports tab with coupon history and per-offer stats"
```

---

### Task 3: Testes completos e deploy

**Files:** nenhum novo — apenas execução e verificação.

- [ ] **Step 1: Testes e tipos do site**

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

Usando o navegador: confirmar que `/comerciante/relatorios` existe e está protegida por login (redireciona quem não é comerciante autenticado, mesmo comportamento das outras rotas do painel).
