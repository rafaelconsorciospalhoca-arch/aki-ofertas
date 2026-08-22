# Comerciante Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a merchant sign up, register their business, and manage their own offers (create, edit, cancel) — the second leg of the platform's core flow (comerciante cadastra empresa → cria oferta), building on the Foundation's auth/schema and reusing the consumer app's category data.

**Architecture:** Same layering as the consumer-app plan — thin Server Component pages over small, testable `src/lib/` query functions and `src/actions/*.ts` Server Actions. Every mutation re-checks the session role and verifies the acting user owns the business/offer being touched, since middleware alone isn't sufficient defense for Server Actions per the Foundation plan's Global Constraints.

**Tech Stack:** Next.js 14 App Router (Server Components + Server Actions), Prisma (Neon), Auth.js, Zod, Vitest.

## Global Constraints

- Every Server Action re-checks the session role server-side — never trust middleware alone (from the Foundation plan).
- Brand name throughout code and copy is "Aki Ofertas".
- A `'use server'` file may only export `async` functions — pure/sync helper functions (pricing math, slugs) live in plain `src/lib/*.ts` files and are imported into the action files, never exported alongside actions.
- No image upload infrastructure exists yet (Vercel Blob isn't configured) — logo/cover/offer images are plain URL text fields for now, matching how `Offer.imageUrl` already works in the consumer app.
- A newly-registered business starts `PENDING` and stays invisible to consumers until an admin approves it (the admin panel plan builds that approval flow next) — this is expected, not a bug to work around.
- Reuse existing Foundation/consumer-app code: `prisma` (`@/lib/db`), `hashPassword` (`@/lib/password`), `auth` (`@/lib/auth`), `getActiveCategories` (`@/lib/categories`), `DashboardShell` (`@/components/layout/DashboardShell`).

---

## File structure this plan produces

```
src/
  lib/
    slug.ts                       # slugify, randomSlugSuffix
    money.ts                      # reaisToCents, centsToReais
    offer-pricing.ts              # parseOfferInput (pure validation/pricing)
    merchant.ts                   # getBusinessForOwner, getMyOffers, getOfferForOwner
    __tests__/
      slug.test.ts
      money.test.ts
      offer-pricing.test.ts
      merchant.test.ts
  actions/
    merchant-actions.ts           # signUpMerchant, updateBusiness
    offer-actions.ts              # createOffer, updateOffer, cancelOffer
    __tests__/
      merchant-actions.test.ts
      offer-actions.test.ts
  components/
    merchant/
      MerchantSignupForm.tsx
      OfferForm.tsx
      BusinessProfileForm.tsx
  app/
    comerciante/
      cadastro/
        page.tsx
      page.tsx                    # rewritten: real dashboard
      ofertas/
        page.tsx
        nova/
          page.tsx
        [id]/
          page.tsx
      empresa/
        page.tsx
  middleware.ts                   # modified: exclude /comerciante/cadastro from the auth gate
  app/entrar/page.tsx              # modified: show a success banner after signup
  components/layout/DashboardShell.tsx  # modified: brand tokens + active nav state
```

---

### Task 1: Slug utility

**Files:**
- Create: `src/lib/slug.ts`
- Test: `src/lib/__tests__/slug.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `slugify(text: string): string` and `randomSlugSuffix(): string` — used by Task 5 (`signUpMerchant`) and Task 7 (`createOffer`) to build unique, URL-safe slugs.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/slug.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { slugify, randomSlugSuffix } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and hyphenates a simple name', () => {
    expect(slugify('Big Burger')).toBe('big-burger')
  })

  it('strips accents', () => {
    expect(slugify('Pão & Cia')).toBe('pao-cia')
  })

  it('collapses multiple spaces and dashes', () => {
    expect(slugify('Combo  Especial -- Família')).toBe('combo-especial-familia')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('  -Oferta Relâmpago-  ')).toBe('oferta-relampago')
  })
})

describe('randomSlugSuffix', () => {
  it('returns a lowercase alphanumeric string', () => {
    expect(randomSlugSuffix()).toMatch(/^[a-z0-9]+$/)
  })

  it('returns different values across calls', () => {
    const values = new Set(Array.from({ length: 30 }, () => randomSlugSuffix()))
    expect(values.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- slug.test.ts`
Expected: FAIL — `Cannot find module '@/lib/slug'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/slug.ts`:
```ts
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- slug.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/__tests__/slug.test.ts
git commit -m "Add slug generation utility"
```

---

### Task 2: Money parsing utility

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/__tests__/money.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `reaisToCents(value: string): number | null` and `centsToReais(cents: number): string` — used by Task 3 (`parseOfferInput`) and Task 10 (prefilling the edit-offer form).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { reaisToCents, centsToReais } from '@/lib/money'

describe('reaisToCents', () => {
  it('converts a two-decimal value', () => {
    expect(reaisToCents('29.90')).toBe(2990)
  })

  it('pads a one-decimal value', () => {
    expect(reaisToCents('29.9')).toBe(2990)
  })

  it('treats a whole number as zero cents', () => {
    expect(reaisToCents('29')).toBe(2900)
  })

  it('handles small values correctly', () => {
    expect(reaisToCents('0.05')).toBe(5)
  })

  it('returns null for non-numeric input', () => {
    expect(reaisToCents('abc')).toBeNull()
  })

  it('returns null for a negative value', () => {
    expect(reaisToCents('-5')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(reaisToCents('')).toBeNull()
  })
})

describe('centsToReais', () => {
  it('formats cents back into a two-decimal string', () => {
    expect(centsToReais(2990)).toBe('29.90')
  })

  it('pads small values', () => {
    expect(centsToReais(5)).toBe('0.05')
  })

  it('round-trips through reaisToCents', () => {
    expect(reaisToCents(centsToReais(4290))).toBe(4290)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- money.test.ts`
Expected: FAIL — `Cannot find module '@/lib/money'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/money.ts`:
```ts
export function reaisToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null

  const [reais, centsPart = '0'] = trimmed.split('.')
  const paddedCents = centsPart.padEnd(2, '0')
  return Number(reais) * 100 + Number(paddedCents)
}

export function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- money.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/__tests__/money.test.ts
git commit -m "Add money parsing and formatting utilities"
```

---

### Task 3: Offer pricing and validation utility

**Files:**
- Create: `src/lib/offer-pricing.ts`
- Test: `src/lib/__tests__/offer-pricing.test.ts`

**Interfaces:**
- Consumes: `reaisToCents` from `@/lib/money`.
- Produces: `type OfferFormInput = { originalPrice: string; discountPrice: string; startDate: string; endDate: string; quantityAvailable?: string }` and `parseOfferInput(input: OfferFormInput): { originalPrice: number; discountPrice: number; discountPercent: number; startDate: Date; endDate: Date; quantityAvailable: number | null } | { error: string }` — used by Task 7's `createOffer`/`updateOffer`. This lives in a plain `lib` file (not the `'use server'` actions file) because a `'use server'` file may only export async functions, and this is a pure synchronous function.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/offer-pricing.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseOfferInput } from '@/lib/offer-pricing'

const validInput = {
  originalPrice: '42.90',
  discountPrice: '29.90',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
}

describe('parseOfferInput', () => {
  it('computes prices in cents and a rounded discount percent', () => {
    const result = parseOfferInput(validInput)
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.originalPrice).toBe(4290)
      expect(result.discountPrice).toBe(2990)
      expect(result.discountPercent).toBe(30)
    }
  })

  it('rejects an invalid original price', () => {
    const result = parseOfferInput({ ...validInput, originalPrice: 'abc' })
    expect(result).toEqual({ error: 'Informe um preço original válido.' })
  })

  it('rejects an invalid discount price', () => {
    const result = parseOfferInput({ ...validInput, discountPrice: 'abc' })
    expect(result).toEqual({ error: 'Informe um preço promocional válido.' })
  })

  it('rejects when the discount price is not lower than the original price', () => {
    const result = parseOfferInput({ ...validInput, discountPrice: '50.00' })
    expect(result).toEqual({ error: 'O preço promocional precisa ser menor que o preço original.' })
  })

  it('rejects invalid dates', () => {
    const result = parseOfferInput({ ...validInput, startDate: 'not-a-date' })
    expect(result).toEqual({ error: 'Datas inválidas.' })
  })

  it('rejects when the end date is not after the start date', () => {
    const result = parseOfferInput({ ...validInput, startDate: '2026-02-01', endDate: '2026-01-01' })
    expect(result).toEqual({ error: 'A data final precisa ser depois da data inicial.' })
  })

  it('parses an optional quantityAvailable', () => {
    const result = parseOfferInput({ ...validInput, quantityAvailable: '10' })
    if (!('error' in result)) {
      expect(result.quantityAvailable).toBe(10)
    } else {
      throw new Error('expected success')
    }
  })

  it('leaves quantityAvailable null when omitted', () => {
    const result = parseOfferInput(validInput)
    if (!('error' in result)) {
      expect(result.quantityAvailable).toBeNull()
    } else {
      throw new Error('expected success')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- offer-pricing.test.ts`
Expected: FAIL — `Cannot find module '@/lib/offer-pricing'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/offer-pricing.ts`:
```ts
import { reaisToCents } from '@/lib/money'

export type OfferFormInput = {
  originalPrice: string
  discountPrice: string
  startDate: string
  endDate: string
  quantityAvailable?: string
}

export type ParsedOffer = {
  originalPrice: number
  discountPrice: number
  discountPercent: number
  startDate: Date
  endDate: Date
  quantityAvailable: number | null
}

export function parseOfferInput(input: OfferFormInput): ParsedOffer | { error: string } {
  const originalPrice = reaisToCents(input.originalPrice)
  if (originalPrice === null || originalPrice <= 0) {
    return { error: 'Informe um preço original válido.' }
  }

  const discountPrice = reaisToCents(input.discountPrice)
  if (discountPrice === null || discountPrice <= 0) {
    return { error: 'Informe um preço promocional válido.' }
  }

  if (discountPrice >= originalPrice) {
    return { error: 'O preço promocional precisa ser menor que o preço original.' }
  }

  const startDate = new Date(input.startDate)
  const endDate = new Date(input.endDate)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: 'Datas inválidas.' }
  }
  if (endDate <= startDate) {
    return { error: 'A data final precisa ser depois da data inicial.' }
  }

  const quantityAvailable = input.quantityAvailable ? Number(input.quantityAvailable) : null
  const discountPercent = Math.round((1 - discountPrice / originalPrice) * 100)

  return { originalPrice, discountPrice, discountPercent, startDate, endDate, quantityAvailable }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- offer-pricing.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/offer-pricing.ts src/lib/__tests__/offer-pricing.test.ts
git commit -m "Add offer pricing and validation utility"
```

---

### Task 4: Merchant read queries

**Files:**
- Create: `src/lib/merchant.ts`
- Test: `src/lib/__tests__/merchant.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `getBusinessForOwner(ownerId: string)` (returns the business row with its `category` included, or `null`), `getMyOffers(businessId: string)` (all offers for that business, any status, newest first), `getOfferForOwner(id: string, businessId: string)` (a single offer scoped to that business, or `null`) — used by Task 9 (dashboard, offers list), Task 10 (edit offer page).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/merchant.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBusinessForOwner, getMyOffers, getOfferForOwner } from '@/lib/merchant'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findFirst: vi.fn() },
    offer: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))

describe('getBusinessForOwner', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries the business owned by the given user, including its category', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await getBusinessForOwner('user-1')

    expect(prisma.business.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      include: { category: true },
    })
    expect(result).toEqual({ id: 'biz-1' })
  })
})

describe('getMyOffers', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries all offers for the business ordered by newest first', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([{ id: 'offer-1' }] as never)

    const result = await getMyOffers('biz-1')

    expect(prisma.offer.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'offer-1' }])
  })
})

describe('getOfferForOwner', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('scopes the lookup to both the offer id and the business id', async () => {
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await getOfferForOwner('offer-1', 'biz-1')

    expect(prisma.offer.findFirst).toHaveBeenCalledWith({
      where: { id: 'offer-1', businessId: 'biz-1' },
    })
    expect(result).toEqual({ id: 'offer-1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- merchant.test.ts`
Expected: FAIL — `Cannot find module '@/lib/merchant'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/merchant.ts`:
```ts
import { prisma } from '@/lib/db'

export async function getBusinessForOwner(ownerId: string) {
  return prisma.business.findFirst({
    where: { ownerId },
    include: { category: true },
  })
}

export async function getMyOffers(businessId: string) {
  return prisma.offer.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOfferForOwner(id: string, businessId: string) {
  return prisma.offer.findFirst({
    where: { id, businessId },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- merchant.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/merchant.ts src/lib/__tests__/merchant.test.ts
git commit -m "Add merchant read queries for business and offers"
```

---

### Task 5: Merchant signup action

**Files:**
- Create: `src/actions/merchant-actions.ts`
- Test: `src/actions/__tests__/merchant-actions.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `hashPassword` from `@/lib/password`, `slugify`/`randomSlugSuffix` from `@/lib/slug`.
- Produces: `signUpMerchant(input: { ownerName: string; email: string; password: string; businessName: string; categoryId: string; whatsapp: string; address: string; city: string; state: string; lat: number; lng: number }): Promise<{ ok: true; businessId: string } | { ok: false; error: string }>` — used by Task 8's signup form.

- [ ] **Step 1: Write the failing test**

Create `src/actions/__tests__/merchant-actions.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signUpMerchant } from '@/actions/merchant-actions'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

const validInput = {
  ownerName: 'João Silva',
  email: 'joao@example.com',
  password: 'senha1234',
  businessName: 'Pizza Boa',
  categoryId: 'cat-1',
  whatsapp: '5546999998888',
  address: 'Rua das Flores, 10',
  city: 'Marmeleiro',
  state: 'pr',
  lat: -25.9,
  lng: -53.05,
}

describe('signUpMerchant', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid email', async () => {
    const result = await signUpMerchant({ ...validInput, email: 'not-an-email' })
    expect(result).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects a state that is not a 2-letter code', async () => {
    const result = await signUpMerchant({ ...validInput, state: 'Parana' })
    expect(result).toEqual({ ok: false, error: 'Use a sigla do estado (ex: PR).' })
  })

  it('rejects a duplicate email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const result = await signUpMerchant(validInput)
    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
  })

  it('fails gracefully when the free plan is missing', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null as never)

    const result = await signUpMerchant(validInput)
    expect(result).toEqual({
      ok: false,
      error: 'Não foi possível concluir o cadastro. Tente novamente mais tarde.',
    })
  })

  it('creates the owner and business, uppercasing the state and hashing the password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({ id: 'plan-free', name: 'Grátis' } as never)

    const userCreate = vi.fn().mockResolvedValue({ id: 'user-1' })
    const businessCreate = vi.fn().mockResolvedValue({ id: 'biz-1' })

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: unknown) => {
      return (callback as (tx: unknown) => unknown)({
        user: { create: userCreate },
        business: { create: businessCreate },
      })
    })

    const result = await signUpMerchant(validInput)

    expect(result).toEqual({ ok: true, businessId: 'biz-1' })
    expect(userCreate.mock.calls[0][0].data.role).toBe('MERCHANT')
    expect(userCreate.mock.calls[0][0].data.passwordHash).not.toBe('senha1234')

    const businessData = businessCreate.mock.calls[0][0].data
    expect(businessData.ownerId).toBe('user-1')
    expect(businessData.state).toBe('PR')
    expect(businessData.status).toBe('PENDING')
    expect(businessData.planId).toBe('plan-free')
    expect((businessData.slug as string).startsWith('pizza-boa-')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- merchant-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/merchant-actions'`

- [ ] **Step 3: Write the implementation**

Create `src/actions/merchant-actions.ts`:
```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { slugify, randomSlugSuffix } from '@/lib/slug'

const signUpMerchantSchema = z.object({
  ownerName: z.string().min(2, 'Informe seu nome.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  businessName: z.string().min(2, 'Informe o nome da empresa.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  whatsapp: z.string().min(8, 'Informe um WhatsApp válido.'),
  address: z.string().min(3, 'Informe o endereço.'),
  city: z.string().min(2, 'Informe a cidade.'),
  state: z.string().length(2, 'Use a sigla do estado (ex: PR).'),
  lat: z.number({ invalid_type_error: 'Informe a latitude.' }),
  lng: z.number({ invalid_type_error: 'Informe a longitude.' }),
})

type SignUpMerchantInput = z.infer<typeof signUpMerchantSchema>
type SignUpMerchantResult = { ok: true; businessId: string } | { ok: false; error: string }

export async function signUpMerchant(input: SignUpMerchantInput): Promise<SignUpMerchantResult> {
  const parsed = signUpMerchantSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  const freePlan = await prisma.plan.findUnique({ where: { name: 'Grátis' } })
  if (!freePlan) {
    return { ok: false, error: 'Não foi possível concluir o cadastro. Tente novamente mais tarde.' }
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const slug = `${slugify(parsed.data.businessName)}-${randomSlugSuffix()}`

  const business = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        name: parsed.data.ownerName,
        email: parsed.data.email,
        passwordHash,
        role: 'MERCHANT',
      },
    })

    return tx.business.create({
      data: {
        ownerId: owner.id,
        name: parsed.data.businessName,
        categoryId: parsed.data.categoryId,
        whatsapp: parsed.data.whatsapp,
        address: parsed.data.address,
        city: parsed.data.city,
        state: parsed.data.state.toUpperCase(),
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        status: 'PENDING',
        planId: freePlan.id,
        slug,
      },
    })
  })

  return { ok: true, businessId: business.id }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- merchant-actions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/actions/merchant-actions.ts src/actions/__tests__/merchant-actions.test.ts
git commit -m "Add merchant signup server action"
```

---

### Task 6: Business profile update action

**Files:**
- Modify: `src/actions/merchant-actions.ts` (add `updateBusiness`)
- Modify: `src/actions/__tests__/merchant-actions.test.ts` (add its tests)

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `prisma` from `@/lib/db`.
- Produces: `updateBusiness(input: { name: string; categoryId: string; description?: string; phone?: string; whatsapp?: string; email?: string; instagram?: string; website?: string; address: string; number?: string; neighborhood?: string; city: string; state: string; zip?: string; logoUrl?: string; coverUrl?: string }): Promise<{ ok: true } | { ok: false; error: string }>` — used by Task 11's business profile form.

- [ ] **Step 1: Write the failing test**

In `src/actions/__tests__/merchant-actions.test.ts`, replace the file's existing import/mock header (everything from the top down through the closing `}))` of the `vi.mock('@/lib/db', ...)` call) with this consolidated version — it adds `updateBusiness`/`auth` to the imports, adds a new `@/lib/auth` mock, and adds `business: { findFirst: vi.fn(), update: vi.fn() }` to the existing `prisma` mock:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signUpMerchant, updateBusiness } from '@/actions/merchant-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    business: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))
```

Leave the rest of the file (the existing `validInput` constant and `describe('signUpMerchant', ...)` block) untouched. Then append the new `describe('updateBusiness', ...)` block at the end of the file:
```ts
const validBusinessInput = {
  name: 'Pizza Boa',
  categoryId: 'cat-1',
  address: 'Rua das Flores, 10',
  city: 'Marmeleiro',
  state: 'pr',
}

describe('updateBusiness', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateBusiness(validBusinessInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the session role is not MERCHANT', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'CONSUMER' } } as never)
    const result = await updateBusiness(validBusinessInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects invalid input', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await updateBusiness({ ...validBusinessInput, state: 'Parana' })
    expect(result).toEqual({ ok: false, error: 'Use a sigla do estado (ex: PR).' })
  })

  it('rejects when no business is owned by this user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(null as never)

    const result = await updateBusiness(validBusinessInput)
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('updates the business owned by this user, uppercasing the state', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusiness(validBusinessInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'biz-1' },
        data: expect.objectContaining({ name: 'Pizza Boa', state: 'PR' }),
      }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- merchant-actions.test.ts`
Expected: FAIL — `updateBusiness is not a function` (or similar export-not-found error)

- [ ] **Step 3: Write the implementation**

Append to `src/actions/merchant-actions.ts` (add the import at the top alongside the existing ones):
```ts
import { auth } from '@/lib/auth'
```

```ts
const updateBusinessSchema = z.object({
  name: z.string().min(2, 'Informe o nome da empresa.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  description: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')),
  instagram: z.string().optional(),
  website: z.string().optional(),
  address: z.string().min(3, 'Informe o endereço.'),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(2, 'Informe a cidade.'),
  state: z.string().length(2, 'Use a sigla do estado (ex: PR).'),
  zip: z.string().optional(),
  logoUrl: z.string().url('URL inválida.').optional().or(z.literal('')),
  coverUrl: z.string().url('URL inválida.').optional().or(z.literal('')),
})

type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>
type UpdateBusinessResult = { ok: true } | { ok: false; error: string }

export async function updateBusiness(input: UpdateBusinessInput): Promise<UpdateBusinessResult> {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'MERCHANT') {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = updateBusinessSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const business = await prisma.business.findFirst({ where: { ownerId: session.user.id as string } })
  if (!business) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  await prisma.business.update({
    where: { id: business.id },
    data: {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description || null,
      phone: parsed.data.phone || null,
      whatsapp: parsed.data.whatsapp || null,
      email: parsed.data.email || null,
      instagram: parsed.data.instagram || null,
      website: parsed.data.website || null,
      address: parsed.data.address,
      number: parsed.data.number || null,
      neighborhood: parsed.data.neighborhood || null,
      city: parsed.data.city,
      state: parsed.data.state.toUpperCase(),
      zip: parsed.data.zip || null,
      logoUrl: parsed.data.logoUrl || null,
      coverUrl: parsed.data.coverUrl || null,
    },
  })

  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- merchant-actions.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/actions/merchant-actions.ts src/actions/__tests__/merchant-actions.test.ts
git commit -m "Add business profile update action"
```

---

### Task 7: Offer create, update, and cancel actions

**Files:**
- Create: `src/actions/offer-actions.ts`
- Test: `src/actions/__tests__/offer-actions.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `auth` from `@/lib/auth`, `slugify`/`randomSlugSuffix` from `@/lib/slug`, `parseOfferInput`/`OfferFormInput` from `@/lib/offer-pricing`.
- Produces: `type OfferActionInput = OfferFormInput & { title: string; description?: string; imageUrl?: string; categoryId: string }`, `createOffer(input: OfferActionInput): Promise<{ ok: true; offerId: string } | { ok: false; error: string }>`, `updateOffer(offerId: string, input: OfferActionInput): Promise<{ ok: true; offerId: string } | { ok: false; error: string }>`, `cancelOffer(offerId: string): Promise<{ ok: true } | { ok: false; error: string }>` — used by Task 10's offer form.

- [ ] **Step 1: Write the failing test**

Create `src/actions/__tests__/offer-actions.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOffer, updateOffer, cancelOffer } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findFirst: vi.fn() },
    offer: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const validInput = {
  title: 'Combo Especial',
  originalPrice: '42.90',
  discountPrice: '29.90',
  categoryId: 'cat-1',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
}

describe('createOffer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no merchant session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await createOffer(validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the session role is not MERCHANT', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'CONSUMER' } } as never)
    const result = await createOffer(validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects invalid pricing', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await createOffer({ ...validInput, discountPrice: '50.00' })
    expect(result).toEqual({ ok: false, error: 'O preço promocional precisa ser menor que o preço original.' })
  })

  it('creates the offer under the merchant business with a generated slug', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.offer.create).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await createOffer(validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    const data = vi.mocked(prisma.offer.create).mock.calls[0][0].data
    expect(data.businessId).toBe('biz-1')
    expect(data.status).toBe('ACTIVE')
    expect(data.discountPercent).toBe(30)
    expect((data.slug as string).startsWith('combo-especial-')).toBe(true)
  })
})

describe('updateOffer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the offer does not belong to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null as never)

    const result = await updateOffer('offer-2', validInput)
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('updates the offer when it belongs to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.offer.update).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await updateOffer('offer-1', validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    expect(prisma.offer.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'offer-1' } }))
  })
})

describe('cancelOffer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the offer does not belong to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null as never)

    const result = await cancelOffer('offer-2')
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
  })

  it('marks the offer CANCELLED when it belongs to the merchant business', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.offer.update).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await cancelOffer('offer-1')

    expect(result).toEqual({ ok: true })
    expect(prisma.offer.update).toHaveBeenCalledWith({ where: { id: 'offer-1' }, data: { status: 'CANCELLED' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- offer-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/offer-actions'`

- [ ] **Step 3: Write the implementation**

Create `src/actions/offer-actions.ts`:
```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { slugify, randomSlugSuffix } from '@/lib/slug'
import { parseOfferInput, type OfferFormInput } from '@/lib/offer-pricing'

const offerSchema = z.object({
  title: z.string().min(3, 'Informe um título.'),
  description: z.string().optional(),
  imageUrl: z.string().url('URL inválida.').optional().or(z.literal('')),
  originalPrice: z.string().min(1, 'Informe o preço original.'),
  discountPrice: z.string().min(1, 'Informe o preço promocional.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  quantityAvailable: z.string().optional(),
  startDate: z.string().min(1, 'Informe a data inicial.'),
  endDate: z.string().min(1, 'Informe a data final.'),
})

type OfferActionInput = OfferFormInput & z.infer<typeof offerSchema>
type OfferResult = { ok: true; offerId: string } | { ok: false; error: string }

async function requireMerchantBusiness() {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'MERCHANT') {
    return null
  }
  return prisma.business.findFirst({ where: { ownerId: session.user.id as string } })
}

export async function createOffer(input: OfferActionInput): Promise<OfferResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = offerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const computed = parseOfferInput(parsed.data)
  if ('error' in computed) {
    return { ok: false, error: computed.error }
  }

  const slug = `${slugify(parsed.data.title)}-${randomSlugSuffix()}`

  const offer = await prisma.offer.create({
    data: {
      businessId: business.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
      originalPrice: computed.originalPrice,
      discountPrice: computed.discountPrice,
      discountPercent: computed.discountPercent,
      categoryId: parsed.data.categoryId,
      quantityAvailable: computed.quantityAvailable,
      startDate: computed.startDate,
      endDate: computed.endDate,
      status: 'ACTIVE',
      slug,
    },
  })

  return { ok: true, offerId: offer.id }
}

export async function updateOffer(offerId: string, input: OfferActionInput): Promise<OfferResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.offer.findFirst({ where: { id: offerId, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Oferta não encontrada.' }
  }

  const parsed = offerSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const computed = parseOfferInput(parsed.data)
  if ('error' in computed) {
    return { ok: false, error: computed.error }
  }

  await prisma.offer.update({
    where: { id: offerId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
      originalPrice: computed.originalPrice,
      discountPrice: computed.discountPrice,
      discountPercent: computed.discountPercent,
      categoryId: parsed.data.categoryId,
      quantityAvailable: computed.quantityAvailable,
      startDate: computed.startDate,
      endDate: computed.endDate,
    },
  })

  return { ok: true, offerId }
}

export async function cancelOffer(offerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.offer.findFirst({ where: { id: offerId, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Oferta não encontrada.' }
  }

  await prisma.offer.update({ where: { id: offerId }, data: { status: 'CANCELLED' } })

  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- offer-actions.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/actions/offer-actions.ts src/actions/__tests__/offer-actions.test.ts
git commit -m "Add offer create, update, and cancel actions"
```

---

### Task 8: Merchant signup page (and middleware fix)

**Files:**
- Create: `src/app/comerciante/cadastro/page.tsx`, `src/components/merchant/MerchantSignupForm.tsx`
- Modify: `src/middleware.ts`, `src/app/entrar/page.tsx`

**Interfaces:**
- Consumes: `getActiveCategories` from `@/lib/categories`, `signUpMerchant` from `@/actions/merchant-actions`.
- Produces: `/comerciante/cadastro` route, publicly reachable (unauthenticated). No later task depends on new exports here.

**Why the middleware needs a fix first:** the current middleware (from the Foundation plan) redirects any unauthenticated request under `/comerciante/**` to `/entrar` — that would block this very signup page from ever being reached by a new merchant who isn't logged in yet.

- [ ] **Step 1: Exclude `/comerciante/cadastro` from the auth gate**

In `src/middleware.ts`, find this block:
```ts
export default auth((req) => {
  const { pathname } = req.nextUrl
  const role = (req.auth?.user as { role?: string } | undefined)?.role

  const isMerchantArea = pathname.startsWith('/comerciante')
  const isAdminArea = pathname.startsWith('/admin')
```

Replace it with:
```ts
export default auth((req) => {
  const { pathname } = req.nextUrl
  const role = (req.auth?.user as { role?: string } | undefined)?.role

  const isMerchantSignup = pathname === '/comerciante/cadastro'
  const isMerchantArea = pathname.startsWith('/comerciante') && !isMerchantSignup
  const isAdminArea = pathname.startsWith('/admin')
```

The rest of the file (the redirect checks using `isMerchantArea`/`isAdminArea`) is unchanged — `isMerchantSignup` paths now fall through both `if` blocks and reach `NextResponse.next()` at the end.

- [ ] **Step 2: Verify the exclusion works**

Run: `npm run dev` in the background.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/comerciante/cadastro` (expect `200`, not a redirect).
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/comerciante` (expect `307`, still gated — confirms the exclusion is scoped to only the signup path).
Stop the dev server.

- [ ] **Step 3: Write the signup form component**

Create `src/components/merchant/MerchantSignupForm.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUpMerchant } from '@/actions/merchant-actions'

type Values = {
  ownerName: string
  email: string
  password: string
  businessName: string
  categoryId: string
  whatsapp: string
  address: string
  city: string
  state: string
  lat: string
  lng: string
}

export function MerchantSignupForm({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Values>({
    ownerName: '',
    email: '',
    password: '',
    businessName: '',
    categoryId: categories[0]?.id ?? '',
    whatsapp: '',
    address: '',
    city: '',
    state: '',
    lat: '',
    lng: '',
  })

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const lat = Number(values.lat)
    const lng = Number(values.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Informe latitude e longitude válidas.')
      return
    }

    setSaving(true)
    const result = await signUpMerchant({ ...values, lat, lng })
    setSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    router.push('/entrar?cadastro=sucesso')
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Sua conta</p>
      <input placeholder="Seu nome" value={values.ownerName} onChange={(e) => update('ownerName', e.target.value)} className={inputClass} required />
      <input type="email" placeholder="E-mail" value={values.email} onChange={(e) => update('email', e.target.value)} className={inputClass} required />
      <input type="password" placeholder="Senha" value={values.password} onChange={(e) => update('password', e.target.value)} className={inputClass} required />

      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Sua empresa</p>
      <input placeholder="Nome da empresa" value={values.businessName} onChange={(e) => update('businessName', e.target.value)} className={inputClass} required />
      <select value={values.categoryId} onChange={(e) => update('categoryId', e.target.value)} className={inputClass}>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <input placeholder="WhatsApp (com DDD)" value={values.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} className={inputClass} required />
      <input placeholder="Endereço" value={values.address} onChange={(e) => update('address', e.target.value)} className={inputClass} required />
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Cidade" value={values.city} onChange={(e) => update('city', e.target.value)} className={inputClass} required />
        <input placeholder="UF" maxLength={2} value={values.state} onChange={(e) => update('state', e.target.value)} className={inputClass} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Latitude" value={values.lat} onChange={(e) => update('lat', e.target.value)} className={inputClass} required />
        <input placeholder="Longitude" value={values.lng} onChange={(e) => update('lng', e.target.value)} className={inputClass} required />
      </div>
      <p className="text-xs text-neutral-400">
        Dica: clique com o botão direito no Google Maps sobre o endereço da sua empresa para copiar as coordenadas.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Cadastrando...' : 'Cadastrar empresa'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Wire the signup page**

Create `src/app/comerciante/cadastro/page.tsx`:
```tsx
import { getActiveCategories } from '@/lib/categories'
import { MerchantSignupForm } from '@/components/merchant/MerchantSignupForm'

export default async function ComercianteCadastroPage() {
  const categories = await getActiveCategories()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="mb-1 text-xl font-bold text-neutral-900">Cadastre sua empresa</h1>
      <p className="mb-6 text-sm text-neutral-500">Publique ofertas e alcance clientes perto de você.</p>
      <MerchantSignupForm categories={categories} />
    </div>
  )
}
```

- [ ] **Step 5: Show a success banner on `/entrar` after signup**

In `src/app/entrar/page.tsx`, inside the `EntrarForm` component (the one wrapped in `<Suspense>`), add a success banner read from the URL. Find the `const searchParams = useSearchParams()` line and add, directly after the opening of the returned JSX's form wrapper (right after the `<h1>Entrar</h1>` line), a conditional block:
```tsx
{searchParams.get('cadastro') === 'sucesso' && (
  <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
    Empresa cadastrada! Faça login para acessar seu painel.
  </p>
)}
```

- [ ] **Step 6: Verify the full signup flow end-to-end**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background.
Run: `curl -s http://localhost:3000/comerciante/cadastro` and confirm the response contains `Cadastre sua empresa` and at least one seeded category name (e.g. `Restaurantes e Lanchonetes`).
Stop the dev server.

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: all tests from Tasks 1-7 (slug, money, offer-pricing, merchant reads, merchant-actions, offer-actions) plus every consumer-app and Foundation test pass, with zero failures. Report the actual total test count from the run's output — don't guess it.

- [ ] **Step 8: Commit**

```bash
git add src/app/comerciante/cadastro src/components/merchant/MerchantSignupForm.tsx src/middleware.ts src/app/entrar/page.tsx
git commit -m "Add merchant signup page and exclude it from the auth gate"
```

---

### Task 9: Merchant dashboard and offers list

**Files:**
- Modify: `src/app/comerciante/page.tsx` (replace the placeholder)
- Create: `src/app/comerciante/ofertas/page.tsx`
- Modify: `src/components/layout/DashboardShell.tsx` (brand tokens + active nav state)

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`, `getBusinessForOwner`/`getMyOffers` from `@/lib/merchant`.
- Produces: real `/comerciante` and `/comerciante/ofertas` pages. No later task consumes new exports here (Task 10 links to `/comerciante/ofertas/nova` and `/comerciante/ofertas/[id]`, both separate routes).

- [ ] **Step 1: Give `DashboardShell` brand colors and active-state highlighting**

Replace the contents of `src/components/layout/DashboardShell.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS: Record<'comerciante' | 'admin', { href: string; label: string }[]> = {
  comerciante: [
    { href: '/comerciante', label: 'Dashboard' },
    { href: '/comerciante/ofertas', label: 'Ofertas' },
    { href: '/comerciante/cupons/validar', label: 'Validar cupom' },
    { href: '/comerciante/empresa', label: 'Empresa' },
    { href: '/comerciante/plano', label: 'Plano' },
  ],
  admin: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/usuarios', label: 'Usuários' },
    { href: '/admin/empresas', label: 'Empresas' },
    { href: '/admin/categorias', label: 'Categorias' },
    { href: '/admin/cidades', label: 'Cidades' },
    { href: '/admin/planos', label: 'Planos' },
  ],
}

export function DashboardShell({
  area,
  children,
}: {
  area: 'comerciante' | 'admin'
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="w-56 flex-shrink-0 bg-brand-navy p-4 text-white">
        <p className="mb-6 px-2 text-lg font-bold">
          Aki<span className="text-brand-green-light">Ofertas</span>
        </p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS[area].map((item) => {
            const active = item.href === `/${area}` ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-white/10 font-bold text-white' : 'text-neutral-300 hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Wire the real dashboard page**

Replace the contents of `src/app/comerciante/page.tsx`:
```tsx
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getBusinessForOwner, getMyOffers } from '@/lib/merchant'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando aprovação',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  REJECTED: 'Reprovada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default async function ComercianteDashboardPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return (
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Painel do comerciante</h1>
        <p className="mt-2 text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
      </div>
    )
  }

  const offers = await getMyOffers(business.id)
  const activeCount = offers.filter((offer) => offer.status === 'ACTIVE').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Olá, {session!.user!.name}!</h1>
          <p className="text-sm text-neutral-500">Veja o desempenho da sua empresa.</p>
        </div>
        <Link
          href="/comerciante/ofertas/nova"
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
        >
          + Nova oferta
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <p className="font-bold text-neutral-900">{business.name}</p>
          <p className="text-sm text-neutral-500">{business.category.name}</p>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[business.status]}`}>
          {STATUS_LABEL[business.status]}
        </span>
      </div>

      {business.status === 'PENDING' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Sua empresa está aguardando aprovação do administrador. Suas ofertas só aparecerão para os consumidores
          depois disso.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Ofertas ativas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Total de ofertas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{offers.length}</p>
        </div>
      </div>

      <Link href="/comerciante/ofertas" className="text-sm font-bold text-brand-green">
        Ver todas as ofertas →
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Wire the offers list page**

Create `src/app/comerciante/ofertas/page.tsx`:
```tsx
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getBusinessForOwner, getMyOffers } from '@/lib/merchant'
import { centsToReais } from '@/lib/money'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativa',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
}

export default async function ComercianteOfertasPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const offers = await getMyOffers(business.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Ofertas</h1>
        <Link
          href="/comerciante/ofertas/nova"
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
        >
          + Nova oferta
        </Link>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-neutral-500">Você ainda não publicou nenhuma oferta.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Oferta</th>
                <th className="px-4 py-2">Preço</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{offer.title}</td>
                  <td className="px-4 py-3 text-neutral-600">R$ {centsToReais(offer.discountPrice)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-600">
                      {STATUS_LABEL[offer.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/comerciante/ofertas/${offer.id}`} className="text-xs font-bold text-brand-green">
                      Editar
                    </Link>
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

- [ ] **Step 4: Verify with the seeded merchant account**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Log in via `curl` is impractical for a session-cookie flow — instead verify structurally: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/comerciante` (expect `307`, unauthenticated — confirms the page itself didn't accidentally bypass middleware). Then do a manual sanity check by starting the dev server and, in a browser, logging in as `joao@bigburger.com.br` / `comerciante123` (seeded in the Foundation plan) and confirming `/comerciante` shows "Big Burger", status "Ativa", and at least 1 active offer, and `/comerciante/ofertas` lists "Combo Burguer". Record what you observed in the report.
Stop the dev server.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: no regressions — same test count as the end of Task 8 (this task added no new test files).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/DashboardShell.tsx src/app/comerciante/page.tsx "src/app/comerciante/ofertas/page.tsx"
git commit -m "Add merchant dashboard and offers list pages"
```

---

### Task 10: New and edit offer form pages

**Files:**
- Create: `src/components/merchant/OfferForm.tsx`, `src/app/comerciante/ofertas/nova/page.tsx`, `src/app/comerciante/ofertas/[id]/page.tsx`

**Interfaces:**
- Consumes: `getActiveCategories` from `@/lib/categories`, `getBusinessForOwner`/`getOfferForOwner` from `@/lib/merchant`, `createOffer`/`updateOffer` from `@/actions/offer-actions`, `centsToReais` from `@/lib/money`, `auth` from `@/lib/auth`.
- Produces: `/comerciante/ofertas/nova` and `/comerciante/ofertas/[id]` routes. No later task consumes new exports here.

- [ ] **Step 1: Write the shared offer form component**

Create `src/components/merchant/OfferForm.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOffer, updateOffer } from '@/actions/offer-actions'

type Values = {
  title: string
  description: string
  imageUrl: string
  originalPrice: string
  discountPrice: string
  categoryId: string
  quantityAvailable: string
  startDate: string
  endDate: string
}

export function OfferForm({
  categories,
  offerId,
  initialValues,
}: {
  categories: { id: string; name: string }[]
  offerId?: string
  initialValues?: Values
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(
    initialValues ?? {
      title: '',
      description: '',
      imageUrl: '',
      originalPrice: '',
      discountPrice: '',
      categoryId: categories[0]?.id ?? '',
      quantityAvailable: '',
      startDate: '',
      endDate: '',
    },
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

    const result = offerId ? await updateOffer(offerId, values) : await createOffer(values)

    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push('/comerciante/ofertas')
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Título
        <input value={values.title} onChange={(e) => update('title', e.target.value)} className={inputClass} required />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Descrição
        <textarea
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          className={inputClass}
          rows={3}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        URL da imagem
        <input
          value={values.imageUrl}
          onChange={(e) => update('imageUrl', e.target.value)}
          className={inputClass}
          placeholder="https://..."
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Preço original (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.originalPrice}
            onChange={(e) => update('originalPrice', e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Preço promocional (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.discountPrice}
            onChange={(e) => update('discountPrice', e.target.value)}
            className={inputClass}
            required
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Categoria
        <select value={values.categoryId} onChange={(e) => update('categoryId', e.target.value)} className={inputClass}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Quantidade disponível (opcional)
        <input
          type="number"
          min="0"
          value={values.quantityAvailable}
          onChange={(e) => update('quantityAvailable', e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Início
          <input
            type="date"
            value={values.startDate}
            onChange={(e) => update('startDate', e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Fim
          <input
            type="date"
            value={values.endDate}
            onChange={(e) => update('endDate', e.target.value)}
            className={inputClass}
            required
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : offerId ? 'Salvar alterações' : 'Publicar oferta'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Wire the new-offer page**

Create `src/app/comerciante/ofertas/nova/page.tsx`:
```tsx
import { getActiveCategories } from '@/lib/categories'
import { OfferForm } from '@/components/merchant/OfferForm'

export default async function NovaOfertaPage() {
  const categories = await getActiveCategories()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Nova oferta</h1>
      <OfferForm categories={categories} />
    </div>
  )
}
```

- [ ] **Step 3: Wire the edit-offer page**

Create `src/app/comerciante/ofertas/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveCategories } from '@/lib/categories'
import { getBusinessForOwner, getOfferForOwner } from '@/lib/merchant'
import { centsToReais } from '@/lib/money'
import { OfferForm } from '@/components/merchant/OfferForm'

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function EditarOfertaPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  if (!business) {
    notFound()
  }

  const offer = await getOfferForOwner(params.id, business.id)
  if (!offer) {
    notFound()
  }

  const categories = await getActiveCategories()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar oferta</h1>
      <OfferForm
        categories={categories}
        offerId={offer.id}
        initialValues={{
          title: offer.title,
          description: offer.description ?? '',
          imageUrl: offer.imageUrl ?? '',
          originalPrice: centsToReais(offer.originalPrice),
          discountPrice: centsToReais(offer.discountPrice),
          categoryId: offer.categoryId,
          quantityAvailable: offer.quantityAvailable !== null ? String(offer.quantityAvailable) : '',
          startDate: toDateInputValue(offer.startDate),
          endDate: toDateInputValue(offer.endDate),
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. As with Task 9, do a manual check logged in as `joao@bigburger.com.br`: open `/comerciante/ofertas/nova`, confirm the form renders with the category dropdown populated; open `/comerciante/ofertas/<the seeded offer's id>` (find its id via `/comerciante/ofertas`'s "Editar" link) and confirm the form is prefilled with "Combo Burguer", "29.90", "42.90". Record what you observed in the report.
Stop the dev server.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/merchant/OfferForm.tsx "src/app/comerciante/ofertas/nova" "src/app/comerciante/ofertas/[id]"
git commit -m "Add new and edit offer form pages"
```

---

### Task 11: Business profile edit page

**Files:**
- Create: `src/components/merchant/BusinessProfileForm.tsx`, `src/app/comerciante/empresa/page.tsx`

**Interfaces:**
- Consumes: `getActiveCategories` from `@/lib/categories`, `getBusinessForOwner` from `@/lib/merchant`, `updateBusiness` from `@/actions/merchant-actions`, `auth` from `@/lib/auth`.
- Produces: `/comerciante/empresa` route. Terminal task — nothing later in this plan depends on it.

- [ ] **Step 1: Write the business profile form component**

Create `src/components/merchant/BusinessProfileForm.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusiness } from '@/actions/merchant-actions'

type Values = {
  name: string
  categoryId: string
  description: string
  phone: string
  whatsapp: string
  email: string
  instagram: string
  website: string
  address: string
  number: string
  neighborhood: string
  city: string
  state: string
  zip: string
  logoUrl: string
  coverUrl: string
}

export function BusinessProfileForm({
  categories,
  initialValues,
}: {
  categories: { id: string; name: string }[]
  initialValues: Values
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(initialValues)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    const result = await updateBusiness(values)

    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess(true)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nome da empresa
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Categoria
        <select value={values.categoryId} onChange={(e) => update('categoryId', e.target.value)} className={inputClass}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Descrição
        <textarea
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          className={inputClass}
          rows={3}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Telefone
          <input value={values.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          WhatsApp
          <input value={values.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          E-mail
          <input type="email" value={values.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Instagram
          <input value={values.instagram} onChange={(e) => update('instagram', e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Site
        <input value={values.website} onChange={(e) => update('website', e.target.value)} className={inputClass} placeholder="https://..." />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Endereço
        <input value={values.address} onChange={(e) => update('address', e.target.value)} className={inputClass} required />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Número
          <input value={values.number} onChange={(e) => update('number', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Bairro
          <input value={values.neighborhood} onChange={(e) => update('neighborhood', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          CEP
          <input value={values.zip} onChange={(e) => update('zip', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Cidade
          <input value={values.city} onChange={(e) => update('city', e.target.value)} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          UF
          <input maxLength={2} value={values.state} onChange={(e) => update('state', e.target.value)} className={inputClass} required />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        URL do logo
        <input value={values.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} className={inputClass} placeholder="https://..." />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        URL da capa
        <input value={values.coverUrl} onChange={(e) => update('coverUrl', e.target.value)} className={inputClass} placeholder="https://..." />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Dados salvos.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Wire the business profile page**

Create `src/app/comerciante/empresa/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveCategories } from '@/lib/categories'
import { getBusinessForOwner } from '@/lib/merchant'
import { BusinessProfileForm } from '@/components/merchant/BusinessProfileForm'

export default async function ComercianteEmpresaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  if (!business) {
    notFound()
  }

  const categories = await getActiveCategories()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Empresa</h1>
      <BusinessProfileForm
        categories={categories}
        initialValues={{
          name: business.name,
          categoryId: business.categoryId,
          description: business.description ?? '',
          phone: business.phone ?? '',
          whatsapp: business.whatsapp ?? '',
          email: business.email ?? '',
          instagram: business.instagram ?? '',
          website: business.website ?? '',
          address: business.address,
          number: business.number ?? '',
          neighborhood: business.neighborhood ?? '',
          city: business.city,
          state: business.state,
          zip: business.zip ?? '',
          logoUrl: business.logoUrl ?? '',
          coverUrl: business.coverUrl ?? '',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify the full plan end-to-end**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Logged in as `joao@bigburger.com.br`, open `/comerciante/empresa`, confirm the form is prefilled with "Big Burger" and its seeded address/city/state, change the description, save, and confirm the "Dados salvos." message appears and the change persists on reload.
Stop the dev server.

- [ ] **Step 4: Run the full test suite and final verification**

Run: `npm run test` — record the final total test count.
Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run build` — expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant/BusinessProfileForm.tsx src/app/comerciante/empresa
git commit -m "Add business profile edit page"
```

---

## What this plan does not cover

Admin approval of pending businesses (`/admin/empresas`) is the `admin-panel` plan that follows — until it exists, every business created through this plan's signup flow stays `PENDING` and invisible to consumers, which is expected. Coupon validation (`/comerciante/cupons/validar`) and plan selection (`/comerciante/plano`) are both explicitly deferred to the `coupons-and-plans` plan per the design doc's build order; their nav links exist in `DashboardShell` already but 404 until that plan lands, matching the same accepted pattern as the consumer app's `/cupons`/`/favoritos`/`/perfil` links. Logo/cover/offer image upload (vs. pasting a URL) waits on Vercel Blob being configured, which isn't part of this plan's scope.
