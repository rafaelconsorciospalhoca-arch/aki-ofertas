# Comissão Semanal sobre Pedidos de Entrega Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar toda segunda-feira uma comissão percentual (definida por categoria) sobre o valor vendido em pedidos de entrega da semana anterior, isentando o comerciante da mensalidade do plano, e bloqueando o negócio se a cobrança ficar em atraso.

**Architecture:** Dois campos novos no schema (`Category.commissionPercent`, modelo `CommissionInvoice`). Um cron semanal que soma pedidos por negócio e gera cobrança avulsa no Asaas. O webhook do Asaas já existente passa a rotear também por fatura de comissão (via `externalReference`). O admin configura o percentual por categoria; o painel do comerciante mostra o histórico em vez do formulário de assinatura quando a categoria do negócio cobra comissão.

**Tech Stack:** Next.js 14 (App Router, Server Actions, Route Handlers), Prisma/Postgres, Vitest.

## Global Constraints

- `Category.commissionPercent`: `Int?`, `null` = sem comissão. Inteiro entre 0 e 100.
- Comissão incide só sobre `discountPrice × quantity` dos pedidos — **nunca** sobre `deliveryFeeCents`.
- Pedidos que contam: `createdAt` dentro da semana (segunda 00:00 até a segunda seguinte 00:00, exclusive) e `status != 'CANCELLED'`.
- Sem vendas na semana → nenhuma fatura é gerada (nem cobrança no Asaas).
- `CommissionInvoice` é único por `businessId + weekStart` (`@@unique`) — nunca duas faturas pra mesma semana do mesmo negócio.
- `percent`/`feeCents` são gravados na fatura no momento da geração (snapshot) — mudar o percentual da categoria depois não altera faturas já geradas.
- Cobrança em atraso reaproveita o mecanismo já existente de suspensão: `Business.status = 'SUSPENDED'`, com `suspendedReason` distinto (`'COMMISSION_OVERDUE'`, nunca confundir com `'PAYMENT_OVERDUE'` que é de mensalidade), e nunca sobrescreve uma suspensão `'ADMIN'` — mesmo padrão de `suspendForPayment` em `src/lib/billing.ts`.
- Negócio de categoria com comissão fica isento da cobrança de mensalidade (`subscribeToPlan` não cria assinatura no Asaas), mas o `Plan` continua atribuído e seus limites (`maxOffersPerMonth` etc.) continuam valendo normalmente.

---

### Task 1: Schema — `Category.commissionPercent` e modelo `CommissionInvoice`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Category.commissionPercent Int?`.
- Produces: modelo `CommissionInvoice { id, businessId, business, weekStart, weekEnd, salesCents, percent, feeCents, status, asaasPaymentId, dueDate, paidAt, createdAt }`, `@@unique([businessId, weekStart])`, `@@map("commission_invoices")`.
- Produces: `Business.commissionInvoices CommissionInvoice[]`.

- [ ] **Step 1: Adicionar `commissionPercent` ao modelo `Category`**

Em `prisma/schema.prisma`, no modelo `Category`, adicionar o campo (logo após `active`):

```prisma
  commissionPercent Int?
```

- [ ] **Step 2: Adicionar o modelo `CommissionInvoice`**

Logo após o modelo `DeliveryZone` (ou em outro ponto coerente do arquivo), adicionar:

```prisma
model CommissionInvoice {
  id             String    @id @default(cuid())
  businessId     String
  business       Business  @relation(fields: [businessId], references: [id])
  weekStart      DateTime
  weekEnd        DateTime
  salesCents     Int
  percent        Int
  feeCents       Int
  status         String    @default("PENDING")
  asaasPaymentId String?
  dueDate        DateTime
  paidAt         DateTime?
  createdAt      DateTime  @default(now())

  @@unique([businessId, weekStart])
  @@map("commission_invoices")
}
```

- [ ] **Step 3: Ligar `Business` ao novo modelo**

No modelo `Business`, no bloco de relações (perto de `deliveryZones DeliveryZone[]`), adicionar:

```prisma
  commissionInvoices CommissionInvoice[]
```

- [ ] **Step 4: Gerar e aplicar a migration, gerar o client**

```bash
npx prisma migrate dev --name add_commission_billing
npx prisma generate
```
Confirmar que a migration é criada em `prisma/migrations/` e aplica sem erro.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Category.commissionPercent and CommissionInvoice model"
```

---

### Task 2: `lib/weekly-commission.ts` e `createAsaasCharge`

**Files:**
- Create: `src/lib/weekly-commission.ts`
- Create: `src/lib/__tests__/weekly-commission.test.ts`
- Modify: `src/lib/asaas.ts`
- Modify: `src/lib/__tests__/asaas.test.ts`

**Interfaces:**
- Produces: `getPreviousWeekWindow(now?: Date): { weekStart: Date; weekEnd: Date }` — semana anterior completa, segunda 00:00 UTC até a segunda seguinte 00:00 UTC (exclusive).
- Produces: `calculateCommissionFee(salesCents: number, percent: number): number` — `Math.round(salesCents * percent / 100)`.
- Produces: `generateWeeklyCommissionInvoices(now?: Date): Promise<{ created: number; skipped: number; failed: number }>`.
- Produces: `createAsaasCharge(input: { customerId: string; value: number; description: string; externalReference: string; dueDate: Date }): Promise<{ paymentId: string }>` em `src/lib/asaas.ts`.

- [ ] **Step 1: Adicionar `createAsaasCharge` em `src/lib/asaas.ts`**

No final do arquivo:

```ts
export type CreateAsaasChargeInput = {
  customerId: string
  value: number
  description: string
  externalReference: string
  dueDate: Date
}

export async function createAsaasCharge(input: CreateAsaasChargeInput): Promise<{ paymentId: string }> {
  const payment = await asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: 'UNDEFINED',
      value: input.value,
      dueDate: input.dueDate.toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.externalReference,
    }),
  })
  return { paymentId: payment.id as string }
}

export async function getAsaasPaymentInvoiceUrl(paymentId: string): Promise<string | null> {
  const payment = await asaasFetch(`/payments/${paymentId}`, { method: 'GET' })
  return (payment.invoiceUrl as string | undefined) ?? null
}
```

- [ ] **Step 2: Testar `createAsaasCharge`/`getAsaasPaymentInvoiceUrl` em `src/lib/__tests__/asaas.test.ts`**

Ler o arquivo primeiro (já tem `jsonResponse` helper e o padrão de `vi.stubGlobal('fetch', ...)` — reaproveitar). Adicionar no final:

```ts
describe('createAsaasCharge', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates a one-off charge and returns the payment id', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'pay_123' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createAsaasCharge({
      customerId: 'cus_123',
      value: 25.5,
      description: 'Comissão semanal',
      externalReference: 'invoice-1',
      dueDate: new Date('2026-09-01'),
    })

    expect(result).toEqual({ paymentId: 'pay_123' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/payments',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toMatchObject({
      customer: 'cus_123',
      billingType: 'UNDEFINED',
      value: 25.5,
      dueDate: '2026-09-01',
      externalReference: 'invoice-1',
    })
  })
})

describe('getAsaasPaymentInvoiceUrl', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns the invoice url for a payment', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ invoiceUrl: 'https://sandbox.asaas.com/i/xyz' })))

    const url = await getAsaasPaymentInvoiceUrl('pay_123')
    expect(url).toBe('https://sandbox.asaas.com/i/xyz')
  })

  it('returns null when the payment has no invoice url', async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'sandbox-key' } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))

    const url = await getAsaasPaymentInvoiceUrl('pay_123')
    expect(url).toBeNull()
  })
})
```

Update the top-of-file import line to include the two new functions:
```ts
import { createAsaasCustomer, createAsaasSubscription, createAsaasCharge, getAsaasPaymentInvoiceUrl } from '@/lib/asaas'
```

- [ ] **Step 3: Criar `src/lib/weekly-commission.ts`**

```ts
import { prisma } from '@/lib/db'
import { createAsaasCustomer, createAsaasCharge } from '@/lib/asaas'

export function getPreviousWeekWindow(now: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  const day = now.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday))
  const weekStart = new Date(thisMonday)
  weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  return { weekStart, weekEnd: thisMonday }
}

export function calculateCommissionFee(salesCents: number, percent: number): number {
  return Math.round((salesCents * percent) / 100)
}

export type GenerateInvoicesResult = { created: number; skipped: number; failed: number }

export async function generateWeeklyCommissionInvoices(now: Date = new Date()): Promise<GenerateInvoicesResult> {
  const { weekStart, weekEnd } = getPreviousWeekWindow(now)

  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE', category: { commissionPercent: { not: null } } },
    include: { category: true, owner: true },
  })

  let created = 0
  let skipped = 0
  let failed = 0

  for (const business of businesses) {
    const percent = business.category.commissionPercent
    if (percent === null) {
      skipped++
      continue
    }

    const existing = await prisma.commissionInvoice.findUnique({
      where: { businessId_weekStart: { businessId: business.id, weekStart } },
    })
    if (existing) {
      skipped++
      continue
    }

    const orders = await prisma.order.findMany({
      where: { businessId: business.id, createdAt: { gte: weekStart, lt: weekEnd }, status: { not: 'CANCELLED' } },
      select: { discountPrice: true, quantity: true },
    })
    const salesCents = orders.reduce((sum, order) => sum + order.discountPrice * order.quantity, 0)
    if (salesCents === 0) {
      skipped++
      continue
    }

    const feeCents = calculateCommissionFee(salesCents, percent)

    try {
      let asaasCustomerId = business.asaasCustomerId
      if (!asaasCustomerId) {
        asaasCustomerId = await createAsaasCustomer({
          name: business.owner.name,
          cpfCnpj: business.document ?? '',
          email: business.email ?? business.owner.email,
          mobilePhone: business.whatsapp ?? '',
          externalReference: business.id,
        })
        await prisma.business.update({ where: { id: business.id }, data: { asaasCustomerId } })
      }

      const invoice = await prisma.commissionInvoice.create({
        data: { businessId: business.id, weekStart, weekEnd, salesCents, percent, feeCents, dueDate: weekEnd, status: 'PENDING' },
      })

      const { paymentId } = await createAsaasCharge({
        customerId: asaasCustomerId,
        value: feeCents / 100,
        description: `Comissão semanal (${percent}%) — ${weekStart.toLocaleDateString('pt-BR')} a ${weekEnd.toLocaleDateString('pt-BR')}`,
        externalReference: invoice.id,
        dueDate: weekEnd,
      })

      await prisma.commissionInvoice.update({ where: { id: invoice.id }, data: { asaasPaymentId: paymentId } })
      created++
    } catch (err) {
      console.error('generateWeeklyCommissionInvoices failed for business', business.id, err)
      failed++
    }
  }

  return { created, skipped, failed }
}
```

- [ ] **Step 4: Testes em `src/lib/__tests__/weekly-commission.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPreviousWeekWindow, calculateCommissionFee, generateWeeklyCommissionInvoices } from '@/lib/weekly-commission'
import { prisma } from '@/lib/db'
import { createAsaasCustomer, createAsaasCharge } from '@/lib/asaas'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findMany: vi.fn(), update: vi.fn() },
    commissionInvoice: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/asaas', () => ({
  createAsaasCustomer: vi.fn(),
  createAsaasCharge: vi.fn(),
}))

describe('getPreviousWeekWindow', () => {
  it('returns the full previous Monday-to-Monday week for a Monday "now"', () => {
    // 2026-08-31 is a Monday
    const result = getPreviousWeekWindow(new Date('2026-08-31T06:00:00Z'))
    expect(result).toEqual({
      weekStart: new Date('2026-08-24T00:00:00Z'),
      weekEnd: new Date('2026-08-31T00:00:00Z'),
    })
  })

  it('returns the same window regardless of the day of week "now" falls on', () => {
    // 2026-09-02 is a Wednesday, still inside the week that started 2026-08-31
    const result = getPreviousWeekWindow(new Date('2026-09-02T12:00:00Z'))
    expect(result).toEqual({
      weekStart: new Date('2026-08-24T00:00:00Z'),
      weekEnd: new Date('2026-08-31T00:00:00Z'),
    })
  })
})

describe('calculateCommissionFee', () => {
  it('rounds to the nearest cent', () => {
    expect(calculateCommissionFee(9999, 10)).toBe(1000)
    expect(calculateCommissionFee(333, 10)).toBe(33)
    expect(calculateCommissionFee(335, 10)).toBe(34)
  })
})

const commissionBusiness = {
  id: 'biz-1',
  asaasCustomerId: 'cus_existing',
  document: '12345678900',
  email: null,
  whatsapp: '5546999990000',
  category: { commissionPercent: 10 },
  owner: { name: 'João', email: 'joao@x.com' },
}

describe('generateWeeklyCommissionInvoices', () => {
  afterEach(() => vi.clearAllMocks())

  it('skips a business that already has an invoice for the week', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'existing-invoice' } as never)

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(prisma.order.findMany).not.toHaveBeenCalled()
  })

  it('skips a business with zero sales in the week, without creating an invoice', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([])

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 0, skipped: 1, failed: 0 })
    expect(prisma.commissionInvoice.create).not.toHaveBeenCalled()
  })

  it('creates an invoice and an Asaas charge, reusing an existing Asaas customer id', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness] as never)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      { discountPrice: 5000, quantity: 2 },
      { discountPrice: 3000, quantity: 1 },
    ] as never)
    vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)
    vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_123' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 })
    expect(createAsaasCustomer).not.toHaveBeenCalled()
    expect(prisma.commissionInvoice.create).toHaveBeenCalledWith({
      data: {
        businessId: 'biz-1',
        weekStart: new Date('2026-08-24T00:00:00Z'),
        weekEnd: new Date('2026-08-31T00:00:00Z'),
        salesCents: 13000,
        percent: 10,
        feeCents: 1300,
        dueDate: new Date('2026-08-31T00:00:00Z'),
        status: 'PENDING',
      },
    })
    expect(createAsaasCharge).toHaveBeenCalledWith({
      customerId: 'cus_existing',
      value: 13,
      description: expect.stringContaining('10%'),
      externalReference: 'invoice-1',
      dueDate: new Date('2026-08-31T00:00:00Z'),
    })
    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { asaasPaymentId: 'pay_123' },
    })
  })

  it('creates an Asaas customer first when the business has none yet', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([
      { ...commissionBusiness, asaasCustomerId: null },
    ] as never)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ discountPrice: 10000, quantity: 1 }] as never)
    vi.mocked(prisma.commissionInvoice.create).mockResolvedValue({ id: 'invoice-1' } as never)
    vi.mocked(createAsaasCustomer).mockResolvedValue('cus_new')
    vi.mocked(createAsaasCharge).mockResolvedValue({ paymentId: 'pay_123' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 0 })
    expect(createAsaasCustomer).toHaveBeenCalledWith({
      name: 'João', cpfCnpj: '12345678900', email: 'joao@x.com', mobilePhone: '5546999990000', externalReference: 'biz-1',
    })
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'biz-1' }, data: { asaasCustomerId: 'cus_new' } })
  })

  it('counts a business as failed and continues to the next one when the Asaas call throws', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([commissionBusiness, { ...commissionBusiness, id: 'biz-2' }] as never)
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findMany).mockResolvedValue([{ discountPrice: 10000, quantity: 1 }] as never)
    vi.mocked(prisma.commissionInvoice.create)
      .mockResolvedValueOnce({ id: 'invoice-1' } as never)
      .mockResolvedValueOnce({ id: 'invoice-2' } as never)
    vi.mocked(createAsaasCharge).mockRejectedValueOnce(new Error('Asaas fora do ar')).mockResolvedValueOnce({ paymentId: 'pay_456' })

    const result = await generateWeeklyCommissionInvoices(new Date('2026-08-31T06:00:00Z'))

    expect(result).toEqual({ created: 1, skipped: 0, failed: 1 })
  })
})
```

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/asaas.test.ts src/lib/__tests__/weekly-commission.test.ts
```
Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add src/lib/asaas.ts src/lib/__tests__/asaas.test.ts src/lib/weekly-commission.ts src/lib/__tests__/weekly-commission.test.ts
git commit -m "feat: weekly commission calculation and one-off Asaas charge"
```

---

### Task 3: Cron `/api/cron/weekly-commission`

**Files:**
- Create: `src/app/api/cron/weekly-commission/route.ts`
- Create: `src/app/api/cron/weekly-commission/__tests__/route.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `generateWeeklyCommissionInvoices()` de `src/lib/weekly-commission.ts` (Task 2).
- Produces: `GET /api/cron/weekly-commission` — mesma autenticação por `CRON_SECRET` de `/api/cron/expire-trials`.

- [ ] **Step 1: Criar `src/app/api/cron/weekly-commission/route.ts`**

Mesmo padrão de `src/app/api/cron/expire-trials/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { generateWeeklyCommissionInvoices } from '@/lib/weekly-commission'

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await generateWeeklyCommissionInvoices()
  return NextResponse.json(result)
}
```

- [ ] **Step 2: Testes em `src/app/api/cron/weekly-commission/__tests__/route.test.ts`**

Ler `src/app/api/cron/expire-trials/__tests__/route.test.ts` primeiro (mesmo padrão de `process.env.CRON_SECRET` save/restore):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/cron/weekly-commission/route'
import { generateWeeklyCommissionInvoices } from '@/lib/weekly-commission'

vi.mock('@/lib/weekly-commission', () => ({ generateWeeklyCommissionInvoices: vi.fn() }))

function request(authHeader?: string) {
  return new Request('https://akiofertas.com.br/api/cron/weekly-commission', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/weekly-commission', () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = originalSecret
  })

  it('rejects without the correct bearer token', async () => {
    process.env.CRON_SECRET = 'the-secret'

    const response = await GET(request('Bearer wrong'))
    expect(response.status).toBe(401)
    expect(generateWeeklyCommissionInvoices).not.toHaveBeenCalled()
  })

  it('rejects (fails closed) when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(request('Bearer undefined'))
    expect(response.status).toBe(401)
  })

  it('runs the weekly commission generation and returns its result', async () => {
    process.env.CRON_SECRET = 'the-secret'
    vi.mocked(generateWeeklyCommissionInvoices).mockResolvedValue({ created: 3, skipped: 2, failed: 0 })

    const response = await GET(request('Bearer the-secret'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ created: 3, skipped: 2, failed: 0 })
  })
})
```

- [ ] **Step 3: Registrar o cron em `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/expire-trials", "schedule": "0 6 * * *" },
    { "path": "/api/cron/weekly-commission", "schedule": "0 6 * * 1" }
  ]
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/app/api/cron/weekly-commission/__tests__/route.test.ts
```
Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/weekly-commission vercel.json
git commit -m "feat: weekly commission cron job"
```

---

### Task 4: Bloqueio por atraso — `billing.ts` e webhook do Asaas

**Files:**
- Modify: `src/lib/billing.ts`
- Modify: `src/lib/__tests__/billing.test.ts`
- Modify: `src/app/api/webhooks/asaas/route.ts`
- Modify: `src/app/api/webhooks/asaas/__tests__/route.test.ts`

**Interfaces:**
- Produces: `markCommissionInvoicePaid(invoiceId: string): Promise<void>`
- Produces: `markCommissionInvoiceOverdue(invoiceId: string): Promise<void>`

- [ ] **Step 1: Adicionar as duas funções em `src/lib/billing.ts`**

No final do arquivo:

```ts
export async function markCommissionInvoicePaid(invoiceId: string): Promise<void> {
  const invoice = await prisma.commissionInvoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  await prisma.commissionInvoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date() } })

  const business = await prisma.business.findUnique({ where: { id: invoice.businessId } })
  if (business?.suspendedReason === 'COMMISSION_OVERDUE') {
    await prisma.business.update({ where: { id: invoice.businessId }, data: { status: 'ACTIVE', suspendedReason: null } })
  }
}

export async function markCommissionInvoiceOverdue(invoiceId: string): Promise<void> {
  const invoice = await prisma.commissionInvoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  const business = await prisma.business.findUnique({ where: { id: invoice.businessId } })
  if (business?.suspendedReason === 'ADMIN') return

  await prisma.commissionInvoice.update({ where: { id: invoiceId }, data: { status: 'OVERDUE' } })
  await prisma.business.update({
    where: { id: invoice.businessId },
    data: { status: 'SUSPENDED', suspendedReason: 'COMMISSION_OVERDUE' },
  })
}
```

- [ ] **Step 2: Adicionar `commissionInvoice` ao mock de `prisma` em `src/lib/__tests__/billing.test.ts`**

No topo do arquivo, trocar:

```ts
vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
```

por:

```ts
vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn(), update: vi.fn() },
    commissionInvoice: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
```

- [ ] **Step 3: Testes para as duas novas funções**

Adicionar no final de `src/lib/__tests__/billing.test.ts` (mesmo estilo dos `describe`s já existentes):

```ts
import { markCommissionInvoicePaid, markCommissionInvoiceOverdue } from '@/lib/billing'
```
(adicionar ao import já existente do topo do arquivo, junto de `activateSubscription`, `suspendForPayment`)

```ts
describe('markCommissionInvoicePaid', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when the invoice does not exist', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)

    await markCommissionInvoicePaid('invoice-unknown')

    expect(prisma.commissionInvoice.update).not.toHaveBeenCalled()
    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('marks the invoice paid and lifts a commission-overdue suspension', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'COMMISSION_OVERDUE' } as never)

    await markCommissionInvoicePaid('invoice-1')

    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'ACTIVE', suspendedReason: null },
    })
  })

  it('marks the invoice paid without touching the business when it was not suspended for commission overdue', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: null } as never)

    await markCommissionInvoicePaid('invoice-1')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})

describe('markCommissionInvoiceOverdue', () => {
  afterEach(() => vi.clearAllMocks())

  it('does nothing when the invoice does not exist', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue(null)

    await markCommissionInvoiceOverdue('invoice-unknown')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('marks the invoice overdue and suspends the business', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: null } as never)

    await markCommissionInvoiceOverdue('invoice-1')

    expect(prisma.commissionInvoice.update).toHaveBeenCalledWith({ where: { id: 'invoice-1' }, data: { status: 'OVERDUE' } })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'SUSPENDED', suspendedReason: 'COMMISSION_OVERDUE' },
    })
  })

  it('never overrides an admin-imposed suspension', async () => {
    vi.mocked(prisma.commissionInvoice.findUnique).mockResolvedValue({ id: 'invoice-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1', suspendedReason: 'ADMIN' } as never)

    await markCommissionInvoiceOverdue('invoice-1')

    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Estender `src/app/api/webhooks/asaas/route.ts`**

Ler o arquivo primeiro. Trocar o corpo do `POST` para também rotear por fatura de comissão quando não há `subscriptionId`:

```ts
import { NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/app-settings'
import { activateSubscription, suspendForPayment, markCommissionInvoicePaid, markCommissionInvoiceOverdue } from '@/lib/billing'

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
  const commissionInvoiceId = !subscriptionId ? (body?.payment?.externalReference as string | undefined) : undefined

  if (event && subscriptionId) {
    if (ACTIVATE_EVENTS.includes(event)) {
      await activateSubscription(subscriptionId)
    } else if (SUSPEND_EVENTS.includes(event)) {
      await suspendForPayment(subscriptionId)
    }
  } else if (event && commissionInvoiceId) {
    if (ACTIVATE_EVENTS.includes(event)) {
      await markCommissionInvoicePaid(commissionInvoiceId)
    } else if (SUSPEND_EVENTS.includes(event)) {
      await markCommissionInvoiceOverdue(commissionInvoiceId)
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Testes em `src/app/api/webhooks/asaas/__tests__/route.test.ts`**

Ler o arquivo primeiro. Atualizar o mock de `@/lib/billing` pra incluir as duas novas funções:

```ts
vi.mock('@/lib/billing', () => ({
  activateSubscription: vi.fn(),
  suspendForPayment: vi.fn(),
  markCommissionInvoicePaid: vi.fn(),
  markCommissionInvoiceOverdue: vi.fn(),
}))
```

Adicionar o import das duas novas funções ao topo (junto de `activateSubscription`, `suspendForPayment`), e os testes novos:

```ts
it('marks a commission invoice paid on PAYMENT_CONFIRMED when there is no subscription id', async () => {
  vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

  const response = await POST(
    request({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1', externalReference: 'invoice-1' } }, 'correct-token'),
  )

  expect(response.status).toBe(200)
  expect(markCommissionInvoicePaid).toHaveBeenCalledWith('invoice-1')
  expect(activateSubscription).not.toHaveBeenCalled()
})

it('marks a commission invoice overdue on PAYMENT_OVERDUE when there is no subscription id', async () => {
  vi.mocked(getAppSettings).mockResolvedValue({ asaasWebhookToken: 'correct-token' } as never)

  await POST(request({ event: 'PAYMENT_OVERDUE', payment: { id: 'pay_1', externalReference: 'invoice-1' } }, 'correct-token'))

  expect(markCommissionInvoiceOverdue).toHaveBeenCalledWith('invoice-1')
  expect(suspendForPayment).not.toHaveBeenCalled()
})
```

- [ ] **Step 6: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/billing.test.ts src/app/api/webhooks/asaas/__tests__/route.test.ts
```
Esperado: todos passando.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing.ts src/lib/__tests__/billing.test.ts src/app/api/webhooks/asaas
git commit -m "feat: route commission invoice payment/overdue webhooks"
```

---

### Task 5: Admin — configurar comissão por categoria

**Files:**
- Modify: `src/actions/admin-actions.ts`
- Modify: `src/actions/__tests__/admin-actions.test.ts`
- Modify: `src/components/admin/CategoryForm.tsx`
- Modify: `src/app/admin/categorias/[id]/page.tsx`

**Interfaces:**
- Produces: `categorySchema` ganha `commissionPercent: z.string().optional()`.
- Produces: `createCategory`/`updateCategory` gravam `commissionPercent: number | null`.

- [ ] **Step 1: Atualizar `categorySchema`, `createCategory`, `updateCategory` em `src/actions/admin-actions.ts`**

Ler o arquivo primeiro (por volta da linha 52-126). Trocar:

```ts
const categorySchema = z.object({
  name: z.string().min(2, 'Informe o nome da categoria.'),
  icon: z.string().min(1, 'Informe o ícone.'),
  order: z.string().min(1, 'Informe a ordem.'),
  active: z.boolean(),
})
```

por:

```ts
const categorySchema = z.object({
  name: z.string().min(2, 'Informe o nome da categoria.'),
  icon: z.string().min(1, 'Informe o ícone.'),
  order: z.string().min(1, 'Informe a ordem.'),
  active: z.boolean(),
  commissionPercent: z.string().optional(),
})
```

Adicionar, logo abaixo de `parseOrder`:

```ts
function parseCommissionPercent(value: string | undefined): { value: number | null } | { error: string } {
  const trimmed = value?.trim()
  if (!trimmed) return { value: null }
  const percent = Number(trimmed)
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    return { error: 'Percentual de comissão inválido.' }
  }
  return { value: percent }
}
```

Em `createCategory`, depois da checagem de `order` e antes do `prisma.category.findUnique`:

```ts
  const commission = parseCommissionPercent(parsed.data.commissionPercent)
  if ('error' in commission) {
    return { ok: false, error: commission.error }
  }
```

E adicionar `commissionPercent: commission.value,` ao objeto `data` do `prisma.category.create`.

Em `updateCategory`, mesma coisa: adicionar a checagem logo depois da checagem de `order`, e `commissionPercent: commission.value,` ao `data` do `prisma.category.update`.

- [ ] **Step 2: Testes em `src/actions/__tests__/admin-actions.test.ts`**

Ler o arquivo primeiro pra localizar os `describe('createCategory', ...)`/`describe('updateCategory', ...)` já existentes e o formato do input válido usado neles. Adicionar `commissionPercent` (vazio, `''`) ao input válido já usado nesses testes (pra não quebrar os existentes — vazio deve continuar válido, resultando em `null`), e adicionar dois novos testes, um em cada `describe`:

```ts
it('rejects an invalid commission percent', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
  vi.mocked(prisma.category.findUnique).mockResolvedValue(null)

  const result = await createCategory({ name: 'Padarias', icon: 'bread', order: '1', active: true, commissionPercent: '150' })
  expect(result).toEqual({ ok: false, error: 'Percentual de comissão inválido.' })
})

it('saves a valid commission percent', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue(activeAdmin as never)
  vi.mocked(prisma.category.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.category.create).mockResolvedValue({ id: 'cat-1' } as never)

  const result = await createCategory({ name: 'Padarias', icon: 'bread', order: '1', active: true, commissionPercent: '10' })

  expect(result).toEqual({ ok: true, categoryId: 'cat-1' })
  expect(prisma.category.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ commissionPercent: 10 }) }),
  )
})
```

(Adaptar exatamente aos nomes de fixtures/variáveis já usados no arquivo — ler antes de editar. `activeAdmin` é um exemplo do padrão já visto em outros `describe`s deste mesmo arquivo; usar o que já existir lá para admin ativo.)

- [ ] **Step 3: Atualizar `src/components/admin/CategoryForm.tsx`**

Trocar o tipo `Values`:

```ts
type Values = {
  name: string
  icon: string
  order: string
  active: boolean
  commissionPercent: string
}
```

E o valor default (linha ~22):

```ts
  const [values, setValues] = useState<Values>(
    initialValues ?? { name: '', icon: '', order: '0', active: true, commissionPercent: '' },
  )
```

Adicionar o campo no JSX, depois do checkbox "Ativa":

```tsx
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Comissão de entrega (%) — deixe vazio se não cobrar
        <input
          type="number"
          min="0"
          max="100"
          value={values.commissionPercent}
          onChange={(e) => update('commissionPercent', e.target.value)}
          className={inputClass}
        />
      </label>
```

- [ ] **Step 4: Atualizar `src/app/admin/categorias/[id]/page.tsx`**

Adicionar `commissionPercent: category.commissionPercent !== null ? String(category.commissionPercent) : '',` ao objeto `initialValues`.

- [ ] **Step 5: Rodar os testes e verificar tipos**

```bash
npx vitest run src/actions/__tests__/admin-actions.test.ts
npx tsc --noEmit
```
Esperado: todos passando, sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts src/components/admin/CategoryForm.tsx src/app/admin/categorias/\[id\]/page.tsx
git commit -m "feat: admin can set a delivery commission percent per category"
```

---

### Task 6: Isenção de mensalidade em `subscribeToPlan`

**Files:**
- Modify: `src/actions/merchant-actions.ts`
- Modify: `src/actions/__tests__/merchant-actions.test.ts`
- Modify: `src/components/merchant/PlanoForm.tsx`

**Interfaces:**
- Produces: `SubscribeToPlanResult` vira `{ ok: true; invoiceUrl: string | null } | { ok: false; error: string }`.

- [ ] **Step 1: Atualizar `subscribeToPlan` em `src/actions/merchant-actions.ts`**

Ler o arquivo primeiro (por volta da linha 166-232). Trocar o tipo:

```ts
export type SubscribeToPlanResult = { ok: true; invoiceUrl: string | null } | { ok: false; error: string }
```

Na query que busca `business` (`prisma.business.findFirst`), adicionar `category: { select: { commissionPercent: true } }` ao `include` (junto de `owner`).

Logo depois de `await prisma.business.update({ where: { id: business.id }, data: { document } })` e antes do bloco que resolve `asaasCustomerId`, adicionar:

```ts
  if (business.category.commissionPercent !== null) {
    await prisma.business.update({ where: { id: business.id }, data: { planId: plan.id } })
    await prisma.subscription.create({ data: { businessId: business.id, planId: plan.id, status: 'ACTIVE' } })
    return { ok: true, invoiceUrl: null }
  }
```

(Esse bloco fica depois de `const plan = await prisma.plan.findUnique(...)` já existente — a checagem de `plan` continua acontecendo normalmente antes.)

- [ ] **Step 2: Testes em `src/actions/__tests__/merchant-actions.test.ts`**

Ler o `describe('subscribeToPlan', ...)` existente primeiro (por volta da linha 234-300+) pra reaproveitar exatamente o fixture de `business`/`owner` já usado. Adicionar `category: { commissionPercent: null }` a todos os fixtures de `business` já existentes nesse describe (pra não quebrar os testes atuais — `null` é o comportamento padrão, sem comissão). Adicionar um novo teste:

```ts
it('skips Asaas billing and activates the subscription directly when the category charges commission', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
  vi.mocked(prisma.business.findFirst).mockResolvedValue({
    id: 'biz-1', document: null, asaasCustomerId: null, whatsapp: '5546999990000', email: null,
    category: { commissionPercent: 10 },
    owner: { blocked: false, name: 'João', email: 'joao@x.com' },
  } as never)
  vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-1', name: 'Básico', priceCents: 4990 } as never)
  vi.mocked(prisma.subscription.create).mockResolvedValue({ id: 'sub-local-1' } as never)

  const result = await subscribeToPlan('plan-1', '12345678900')

  expect(result).toEqual({ ok: true, invoiceUrl: null })
  expect(createAsaasCustomer).not.toHaveBeenCalled()
  expect(createAsaasSubscription).not.toHaveBeenCalled()
  expect(prisma.subscription.create).toHaveBeenCalledWith({
    data: { businessId: 'biz-1', planId: 'plan-1', status: 'ACTIVE' },
  })
})
```

- [ ] **Step 3: Atualizar `src/components/merchant/PlanoForm.tsx` (defensivo)**

Trocar `window.location.href = result.invoiceUrl` por um tratamento que não navega quando `invoiceUrl` é `null` (esse caminho normalmente não é alcançado, já que a Task 7 esconde o `PlanoForm` pra negócios de categoria com comissão — mas o tipo agora exige o tratamento, e é uma segunda camada de defesa):

```ts
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.invoiceUrl) {
        window.location.href = result.invoiceUrl
      }
```

- [ ] **Step 4: Rodar os testes e verificar tipos**

```bash
npx vitest run src/actions/__tests__/merchant-actions.test.ts
npx tsc --noEmit
```
Esperado: todos passando, sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/actions/merchant-actions.ts src/actions/__tests__/merchant-actions.test.ts src/components/merchant/PlanoForm.tsx
git commit -m "feat: exempt commission-billed businesses from the monthly plan charge"
```

---

### Task 7: Painel do comerciante — histórico de comissão em vez do formulário de plano

**Files:**
- Create: `src/lib/commission-invoices.ts`
- Create: `src/lib/__tests__/commission-invoices.test.ts`
- Create: `src/components/merchant/CommissionPanel.tsx`
- Modify: `src/app/comerciante/plano/page.tsx`

**Interfaces:**
- Consumes: `getAsaasPaymentInvoiceUrl` de `src/lib/asaas.ts` (Task 2).
- Produces: `getCommissionInvoicesForBusiness(businessId: string): Promise<CommissionInvoiceRow[]>`, `CommissionInvoiceRow = { id, weekStart, weekEnd, salesCents, percent, feeCents, status, payUrl }`.

- [ ] **Step 1: Criar `src/lib/commission-invoices.ts`**

```ts
import { prisma } from '@/lib/db'
import { getAsaasPaymentInvoiceUrl } from '@/lib/asaas'

export type CommissionInvoiceRow = {
  id: string
  weekStart: Date
  weekEnd: Date
  salesCents: number
  percent: number
  feeCents: number
  status: string
  payUrl: string | null
}

export async function getCommissionInvoicesForBusiness(businessId: string): Promise<CommissionInvoiceRow[]> {
  const rows = await prisma.commissionInvoice.findMany({
    where: { businessId },
    orderBy: { weekStart: 'desc' },
  })

  return Promise.all(
    rows.map(async (row) => {
      let payUrl: string | null = null
      if ((row.status === 'PENDING' || row.status === 'OVERDUE') && row.asaasPaymentId) {
        try {
          payUrl = await getAsaasPaymentInvoiceUrl(row.asaasPaymentId)
        } catch {
          payUrl = null
        }
      }
      return {
        id: row.id,
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
        salesCents: row.salesCents,
        percent: row.percent,
        feeCents: row.feeCents,
        status: row.status,
        payUrl,
      }
    }),
  )
}
```

- [ ] **Step 2: Testes em `src/lib/__tests__/commission-invoices.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCommissionInvoicesForBusiness } from '@/lib/commission-invoices'
import { prisma } from '@/lib/db'
import { getAsaasPaymentInvoiceUrl } from '@/lib/asaas'

vi.mock('@/lib/db', () => ({
  prisma: { commissionInvoice: { findMany: vi.fn() } },
}))
vi.mock('@/lib/asaas', () => ({ getAsaasPaymentInvoiceUrl: vi.fn() }))

describe('getCommissionInvoicesForBusiness', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns an empty list when there are no invoices', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([])
    const result = await getCommissionInvoicesForBusiness('biz-1')
    expect(result).toEqual([])
  })

  it('resolves a pay url for a PENDING invoice', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'PENDING', asaasPaymentId: 'pay_123',
      },
    ] as never)
    vi.mocked(getAsaasPaymentInvoiceUrl).mockResolvedValue('https://sandbox.asaas.com/i/xyz')

    const result = await getCommissionInvoicesForBusiness('biz-1')

    expect(result).toEqual([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'PENDING', payUrl: 'https://sandbox.asaas.com/i/xyz',
      },
    ])
  })

  it('does not resolve a pay url for a PAID invoice', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'PAID', asaasPaymentId: 'pay_123',
      },
    ] as never)

    const result = await getCommissionInvoicesForBusiness('biz-1')

    expect(result[0].payUrl).toBeNull()
    expect(getAsaasPaymentInvoiceUrl).not.toHaveBeenCalled()
  })

  it('falls back to a null pay url when the Asaas lookup fails', async () => {
    vi.mocked(prisma.commissionInvoice.findMany).mockResolvedValue([
      {
        id: 'invoice-1', weekStart: new Date('2026-08-24'), weekEnd: new Date('2026-08-31'),
        salesCents: 13000, percent: 10, feeCents: 1300, status: 'OVERDUE', asaasPaymentId: 'pay_123',
      },
    ] as never)
    vi.mocked(getAsaasPaymentInvoiceUrl).mockRejectedValue(new Error('Asaas fora do ar'))

    const result = await getCommissionInvoicesForBusiness('biz-1')

    expect(result[0].payUrl).toBeNull()
  })
})
```

- [ ] **Step 3: Criar `src/components/merchant/CommissionPanel.tsx`**

Componente de exibição (sem interatividade — mesmo padrão de `ReportsView.tsx`):

```tsx
import type { CommissionInvoiceRow } from '@/lib/commission-invoices'

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Atrasado' }
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CommissionPanel({ percent, invoices }: { percent: number; invoices: CommissionInvoiceRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Seu ramo cobra <strong>{percent}%</strong> de comissão sobre o valor vendido em pedidos com entrega, em vez de
        mensalidade. Toda segunda-feira geramos a cobrança referente à semana anterior.
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma cobrança gerada ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Semana</th>
                <th className="px-4 py-2">Valor vendido</th>
                <th className="px-4 py-2">Comissão</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-neutral-600">
                    {formatDate(invoice.weekStart)} – {formatDate(invoice.weekEnd)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{formatCents(invoice.salesCents)}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{formatCents(invoice.feeCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[invoice.status]}`}>
                      {STATUS_LABEL[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {invoice.payUrl && (
                      <a href={invoice.payUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-green">
                        Pagar
                      </a>
                    )}
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

- [ ] **Step 4: Atualizar `src/app/comerciante/plano/page.tsx`**

Ler o arquivo primeiro. Adicionar os imports de `getCommissionInvoicesForBusiness` e `CommissionPanel`. Depois de resolver `business` (que já vem com `category` via `getBusinessForOwner`), trocar o final do componente pra escolher entre `PlanoForm` e `CommissionPanel`:

```tsx
import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { getPaidPlans } from '@/lib/plans'
import { getCommissionInvoicesForBusiness } from '@/lib/commission-invoices'
import { PlanoForm } from '@/components/merchant/PlanoForm'
import { CommissionPanel } from '@/components/merchant/CommissionPanel'

function daysLeft(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null
  const ms = trialEndsAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export default async function ComerciantePlanoPage({
  searchParams,
}: {
  searchParams: { pago?: string }
}) {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  const plans = await getPaidPlans()
  const pago = searchParams.pago

  if (!business) {
    return (
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Meu plano</h1>
        <p className="mt-2 text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
      </div>
    )
  }

  const trialDays = daysLeft(business.trialEndsAt)
  const commissionPercent = business.category.commissionPercent

  return (
    <div className="flex flex-col gap-6">
      {pago ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Pagamento em processamento! Assim que confirmado, seu plano será ativado.
        </div>
      ) : null}
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

      {commissionPercent !== null ? (
        <CommissionPanel percent={commissionPercent} invoices={await getCommissionInvoicesForBusiness(business.id)} />
      ) : (
        <PlanoForm plans={plans} initialDocument={business.document ?? ''} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verificar tipos e build**

```bash
npx tsc --noEmit
npm run build
```
Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/commission-invoices.ts src/lib/__tests__/commission-invoices.test.ts src/components/merchant/CommissionPanel.tsx src/app/comerciante/plano/page.tsx
git commit -m "feat: show weekly commission history instead of the plan form for commission-billed businesses"
```

---

### Task 8: Build final, testes completos e deploy

**Files:** nenhum novo — apenas execução e verificação.

- [ ] **Step 1: Testes e tipos do site**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Esperado: tudo passando/sem erros. Confirmar que `/api/cron/weekly-commission` aparece na saída do build.

- [ ] **Step 2: Deploy**

```bash
npx vercel --prod
```
Se falhar com o erro transitório `"Not authorized"`, rodar `npx vercel link --yes` e tentar de novo.

- [ ] **Step 3: Verificação manual em produção**

Usando o navegador: em `/admin/categorias`, editar a categoria "Restaurantes" (ou equivalente) e definir um percentual de comissão; confirmar que salva. Entrar como um comerciante dessa categoria em `/comerciante/plano` e confirmar que aparece o painel de comissão em vez do formulário de assinatura (mesmo sem nenhuma cobrança gerada ainda — deve mostrar "Nenhuma cobrança gerada ainda.").
