# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin approve, reject, or suspend merchant businesses and manage the global category and city lists — closing the platform's core loop (comerciante cadastra empresa → admin aprova → oferta aparece para consumidores) that the Foundation, Consumer-App, and Comerciante-Panel plans already built the rest of.

**Architecture:** Same layering as every prior plan — thin Server Component pages over small, testable `src/lib/` query functions and `src/actions/*.ts` Server Actions. Every mutation re-checks `role === 'ADMIN'` server-side. Approving a business to `ACTIVE` requires no new plumbing on the consumer side: `getFeaturedOffers`/`getOffersList`/`getOfferBySlug`/`getBusinessBySlug` already filter on `business.status === 'ACTIVE'` (from the consumer-app plan), so the moment this plan flips a business's status, its offers become visible with no other code change.

**Tech Stack:** Next.js 14 App Router (Server Components + Server Actions), Prisma (Neon), Auth.js, Zod v4, Vitest.

## Global Constraints

- Every Server Action re-checks the session role server-side — never trust middleware alone (from the Foundation plan).
- Brand name throughout code and copy is "Aki Ofertas".
- A `'use server'` file may only export `async` functions — pure/sync helper functions live in plain `src/lib/*.ts` files (from the Comerciante-Panel plan). This plan's validation logic is small enough to stay inline in the actions file as plain (non-exported) `async` helpers, so no separate pure-function file is needed here.
- The installed Zod version is v4.4.3. `.min()`, `.length()`, `.enum()`, `.optional()` all work the same as v3 — only `z.number({ invalid_type_error: '...' })` needed the v4 `{ error: '...' }` form in an earlier plan, and this plan's schemas don't use `z.number()` (numeric fields like `order` arrive as strings from HTML inputs and are validated manually, matching the pattern already used for `quantityAvailable` in the Comerciante-Panel plan), so no adaptation is expected — but verify with `npx tsc --noEmit` as always rather than assuming.
- `getActiveCategories`/`getActiveCities` (consumer-app plan, `@/lib/categories.ts`) only return `active: true` rows — the admin needs to see and edit *inactive* rows too, so this plan adds separate `getAllCategories`/`getAllCities` functions rather than reusing or modifying those.
- Reuse existing code: `prisma` (`@/lib/db`), `auth` (`@/lib/auth`), `DashboardShell` (`@/components/layout/DashboardShell`, already has an `admin` nav variant from the Foundation plan).

---

## File structure this plan produces

```
src/
  lib/
    admin.ts                      # getPlatformStats, getBusinessesForAdmin, getAllCategories,
                                   # getCategoryById, getAllCities, getCityById
    __tests__/
      admin.test.ts
  actions/
    admin-actions.ts              # updateBusinessStatus, createCategory, updateCategory,
                                   # createCity, updateCity
    __tests__/
      admin-actions.test.ts
  components/
    admin/
      BusinessStatusActions.tsx
      CategoryForm.tsx
      CityForm.tsx
  app/
    admin/
      page.tsx                    # rewritten: real dashboard
      empresas/
        page.tsx
      categorias/
        page.tsx
        nova/
          page.tsx
        [id]/
          page.tsx
      cidades/
        page.tsx
        nova/
          page.tsx
        [id]/
          page.tsx
    comerciante/
      cadastro/
        page.tsx                  # modified: force-dynamic (see Task 9)
      ofertas/
        nova/
          page.tsx                # modified: force-dynamic (see Task 9)
```

---

### Task 1: Admin read queries

**Files:**
- Create: `src/lib/admin.ts`
- Test: `src/lib/__tests__/admin.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `getPlatformStats(): Promise<{ totalUsers: number; totalBusinesses: number; pendingBusinesses: number; activeBusinesses: number; totalOffers: number; totalCities: number }>`, `getBusinessesForAdmin(status?: BusinessStatus)` (all businesses, category included, optionally filtered by status, newest first), `getAllCategories()` (all categories including inactive, ordered by `order`), `getCategoryById(id: string)`, `getAllCities()` (all cities including inactive, ordered by name), `getCityById(id: string)` — used by Task 5 (dashboard), Task 6 (empresas list), Task 7 (categorias pages), Task 8 (cidades pages).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/admin.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPlatformStats,
  getBusinessesForAdmin,
  getAllCategories,
  getCategoryById,
  getAllCities,
  getCityById,
} from '@/lib/admin'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { count: vi.fn() },
    business: { count: vi.fn(), findMany: vi.fn() },
    offer: { count: vi.fn() },
    city: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

describe('getPlatformStats', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('counts users, businesses (total/pending/active), offers, and cities', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(42)
    vi.mocked(prisma.business.count)
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3) // pending
      .mockResolvedValueOnce(6) // active
    vi.mocked(prisma.offer.count).mockResolvedValue(25)
    vi.mocked(prisma.city.count).mockResolvedValue(4)

    const result = await getPlatformStats()

    expect(result).toEqual({
      totalUsers: 42,
      totalBusinesses: 10,
      pendingBusinesses: 3,
      activeBusinesses: 6,
      totalOffers: 25,
      totalCities: 4,
    })
    expect(prisma.business.count).toHaveBeenNthCalledWith(2, { where: { status: 'PENDING' } })
    expect(prisma.business.count).toHaveBeenNthCalledWith(3, { where: { status: 'ACTIVE' } })
  })
})

describe('getBusinessesForAdmin', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries all businesses with category included when no status is given', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([{ id: 'biz-1' }] as never)

    const result = await getBusinessesForAdmin()

    expect(prisma.business.findMany).toHaveBeenCalledWith({
      where: {},
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'biz-1' }])
  })

  it('filters by status when given', async () => {
    vi.mocked(prisma.business.findMany).mockResolvedValue([] as never)

    await getBusinessesForAdmin('PENDING')

    expect(prisma.business.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('getAllCategories', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries every category ordered by order, including inactive ones', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([{ id: 'cat-1' }] as never)

    const result = await getAllCategories()

    expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { order: 'asc' } })
    expect(result).toEqual([{ id: 'cat-1' }])
  })
})

describe('getCategoryById', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries a single category by id', async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await getCategoryById('cat-1')

    expect(prisma.category.findUnique).toHaveBeenCalledWith({ where: { id: 'cat-1' } })
    expect(result).toEqual({ id: 'cat-1' })
  })
})

describe('getAllCities', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries every city ordered by name, including inactive ones', async () => {
    vi.mocked(prisma.city.findMany).mockResolvedValue([{ id: 'city-1' }] as never)

    const result = await getAllCities()

    expect(prisma.city.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } })
    expect(result).toEqual([{ id: 'city-1' }])
  })
})

describe('getCityById', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries a single city by id', async () => {
    vi.mocked(prisma.city.findUnique).mockResolvedValue({ id: 'city-1' } as never)

    const result = await getCityById('city-1')

    expect(prisma.city.findUnique).toHaveBeenCalledWith({ where: { id: 'city-1' } })
    expect(result).toEqual({ id: 'city-1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- admin.test.ts`
Expected: FAIL — `Cannot find module '@/lib/admin'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/admin.ts`:
```ts
import { prisma } from '@/lib/db'
import type { BusinessStatus } from '@prisma/client'

export async function getPlatformStats() {
  const [totalUsers, totalBusinesses, pendingBusinesses, activeBusinesses, totalOffers, totalCities] =
    await Promise.all([
      prisma.user.count(),
      prisma.business.count(),
      prisma.business.count({ where: { status: 'PENDING' } }),
      prisma.business.count({ where: { status: 'ACTIVE' } }),
      prisma.offer.count(),
      prisma.city.count(),
    ])

  return { totalUsers, totalBusinesses, pendingBusinesses, activeBusinesses, totalOffers, totalCities }
}

export async function getBusinessesForAdmin(status?: BusinessStatus) {
  return prisma.business.findMany({
    where: status ? { status } : {},
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getAllCategories() {
  return prisma.category.findMany({ orderBy: { order: 'asc' } })
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } })
}

export async function getAllCities() {
  return prisma.city.findMany({ orderBy: { name: 'asc' } })
}

export async function getCityById(id: string) {
  return prisma.city.findUnique({ where: { id } })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- admin.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts src/lib/__tests__/admin.test.ts
git commit -m "Add admin read queries for stats, businesses, categories, and cities"
```

---

### Task 2: Business status update action

**Files:**
- Create: `src/actions/admin-actions.ts`
- Test: `src/actions/__tests__/admin-actions.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `auth` from `@/lib/auth`.
- Produces: `requireAdmin(): Promise<boolean>` (a non-exported helper other functions in this file reuse — Tasks 3 and 4 modify this same file and call it), `updateBusinessStatus(businessId: string, status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED'): Promise<{ ok: true } | { ok: false; error: string }>` — used by Task 6's `BusinessStatusActions` component.

- [ ] **Step 1: Write the failing test**

Create `src/actions/__tests__/admin-actions.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateBusinessStatus } from '@/actions/admin-actions'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    city: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

describe('updateBusinessStatus', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid status value', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    // @ts-expect-error deliberately invalid for the test
    const result = await updateBusinessStatus('biz-1', 'NOT_A_STATUS')
    expect(result).toEqual({ ok: false, error: 'Status inválido.' })
  })

  it('rejects when the business does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')
    expect(result).toEqual({ ok: false, error: 'Empresa não encontrada.' })
  })

  it('updates the business status when the admin and business are valid', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.business.update).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateBusinessStatus('biz-1', 'ACTIVE')

    expect(result).toEqual({ ok: true })
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'biz-1' },
      data: { status: 'ACTIVE' },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- admin-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/admin-actions'`

- [ ] **Step 3: Write the implementation**

Create `src/actions/admin-actions.ts`:
```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

async function requireAdmin(): Promise<boolean> {
  const session = await auth()
  return Boolean(session?.user) && (session!.user as { role?: string }).role === 'ADMIN'
}

const businessStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED'])

export async function updateBusinessStatus(
  businessId: string,
  status: z.infer<typeof businessStatusSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = businessStatusSchema.safeParse(status)
  if (!parsed.success) {
    return { ok: false, error: 'Status inválido.' }
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  await prisma.business.update({ where: { id: businessId }, data: { status: parsed.data } })

  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- admin-actions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts
git commit -m "Add business status update action"
```

---

### Task 3: Category create and update actions

**Files:**
- Modify: `src/actions/admin-actions.ts` (add `createCategory`, `updateCategory`)
- Modify: `src/actions/__tests__/admin-actions.test.ts` (add their tests)

**Interfaces:**
- Consumes: `requireAdmin` (Task 2, same file), `prisma` from `@/lib/db`.
- Produces: `type CategoryInput = { name: string; icon: string; order: string; active: boolean }`, `createCategory(input: CategoryInput): Promise<{ ok: true; categoryId: string } | { ok: false; error: string }>`, `updateCategory(id: string, input: CategoryInput): Promise<{ ok: true } | { ok: false; error: string }>` — used by Task 7's `CategoryForm`.

- [ ] **Step 1: Write the failing test**

Append to `src/actions/__tests__/admin-actions.test.ts` (add the import at the top alongside the existing one):
```ts
import { updateBusinessStatus, createCategory, updateCategory } from '@/actions/admin-actions'
```

Append these two `describe` blocks at the end of the file:
```ts
const validCategoryInput = { name: 'Pet Shop', icon: 'pet', order: '9', active: true }

describe('createCategory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await createCategory(validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    const result = await createCategory({ ...validCategoryInput, name: 'P' })
    expect(result).toEqual({ ok: false, error: 'Informe o nome da categoria.' })
  })

  it('rejects an invalid order', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)

    const result = await createCategory({ ...validCategoryInput, order: 'abc' })
    expect(result).toEqual({ ok: false, error: 'Ordem inválida.' })
  })

  it('rejects a duplicate category name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const result = await createCategory(validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Esta categoria já existe.' })
  })

  it('creates the category when input is valid and the name is free', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)
    vi.mocked(prisma.category.create).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await createCategory(validCategoryInput)

    expect(result).toEqual({ ok: true, categoryId: 'cat-1' })
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Pet Shop', icon: 'pet', order: 9, active: true },
    })
  })
})

describe('updateCategory', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await updateCategory('cat-1', validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the category does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null as never)

    const result = await updateCategory('cat-1', validCategoryInput)
    expect(result).toEqual({ ok: false, error: 'Categoria não encontrada.' })
  })

  it('updates the category when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: 'cat-1' } as never)
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1' } as never)

    const result = await updateCategory('cat-1', validCategoryInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { name: 'Pet Shop', icon: 'pet', order: 9, active: true },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- admin-actions.test.ts`
Expected: FAIL — `createCategory is not a function` (or similar export-not-found error)

- [ ] **Step 3: Write the implementation**

Append to `src/actions/admin-actions.ts` (add the import at the top alongside the existing ones):
```ts
```
(no new imports needed — `z`, `prisma`, `requireAdmin` already exist in this file)

```ts
const categorySchema = z.object({
  name: z.string().min(2, 'Informe o nome da categoria.'),
  icon: z.string().min(1, 'Informe o ícone.'),
  order: z.string().min(1, 'Informe a ordem.'),
  active: z.boolean(),
})

type CategoryInput = z.infer<typeof categorySchema>
type CategoryResult = { ok: true; categoryId: string } | { ok: false; error: string }

function parseOrder(value: string): number | { error: string } {
  const order = Number(value)
  if (!Number.isInteger(order) || order < 0) {
    return { error: 'Ordem inválida.' }
  }
  return order
}

export async function createCategory(input: CategoryInput): Promise<CategoryResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const order = parseOrder(parsed.data.order)
  if (typeof order !== 'number') {
    return { ok: false, error: order.error }
  }

  const existing = await prisma.category.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return { ok: false, error: 'Esta categoria já existe.' }
  }

  const category = await prisma.category.create({
    data: { name: parsed.data.name, icon: parsed.data.icon, order, active: parsed.data.active },
  })

  return { ok: true, categoryId: category.id }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const order = parseOrder(parsed.data.order)
  if (typeof order !== 'number') {
    return { ok: false, error: order.error }
  }

  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) {
    return { ok: false, error: 'Categoria não encontrada.' }
  }

  await prisma.category.update({
    where: { id },
    data: { name: parsed.data.name, icon: parsed.data.icon, order, active: parsed.data.active },
  })

  return { ok: true }
}
```

Note: the test's "rejects an invalid order" case exercises `parseOrder` before the duplicate-name check, so `prisma.category.findUnique` is mocked to `null` there even though the function never reaches that call — harmless, just keeps the mock in a defined state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- admin-actions.test.ts`
Expected: PASS (13 tests — 5 from Task 2 plus 8 new)

- [ ] **Step 5: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts
git commit -m "Add category create and update actions"
```

---

### Task 4: City create and update actions

**Files:**
- Modify: `src/actions/admin-actions.ts` (add `createCity`, `updateCity`)
- Modify: `src/actions/__tests__/admin-actions.test.ts` (add their tests)

**Interfaces:**
- Consumes: `requireAdmin` (Task 2, same file), `prisma` from `@/lib/db`.
- Produces: `type CityInput = { name: string; state: string; active: boolean; comingSoon: boolean }`, `createCity(input: CityInput): Promise<{ ok: true; cityId: string } | { ok: false; error: string }>`, `updateCity(id: string, input: CityInput): Promise<{ ok: true } | { ok: false; error: string }>` — used by Task 8's `CityForm`.

- [ ] **Step 1: Write the failing test**

Append to `src/actions/__tests__/admin-actions.test.ts` (add the import at the top alongside the existing ones):
```ts
import { updateBusinessStatus, createCategory, updateCategory, createCity, updateCity } from '@/actions/admin-actions'
```

Append these two `describe` blocks at the end of the file:
```ts
const validCityInput = { name: 'Curitiba', state: 'pr', active: true, comingSoon: false }

describe('createCity', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    const result = await createCity(validCityInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects a state that is not a 2-letter code', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    const result = await createCity({ ...validCityInput, state: 'Parana' })
    expect(result).toEqual({ ok: false, error: 'Use a sigla do estado (ex: PR).' })
  })

  it('rejects a duplicate name+state combination', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue({ id: 'existing' } as never)

    const result = await createCity(validCityInput)
    expect(result).toEqual({ ok: false, error: 'Esta cidade já existe.' })
  })

  it('creates the city, uppercasing the state', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.city.create).mockResolvedValue({ id: 'city-1' } as never)

    const result = await createCity(validCityInput)

    expect(result).toEqual({ ok: true, cityId: 'city-1' })
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: { name: 'Curitiba', state: 'PR', active: true, comingSoon: false },
    })
  })
})

describe('updateCity', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the city does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findUnique).mockResolvedValue(null as never)

    const result = await updateCity('city-1', validCityInput)
    expect(result).toEqual({ ok: false, error: 'Cidade não encontrada.' })
  })

  it('updates the city when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.city.findUnique).mockResolvedValue({ id: 'city-1' } as never)
    vi.mocked(prisma.city.update).mockResolvedValue({ id: 'city-1' } as never)

    const result = await updateCity('city-1', validCityInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.city.update).toHaveBeenCalledWith({
      where: { id: 'city-1' },
      data: { name: 'Curitiba', state: 'PR', active: true, comingSoon: false },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- admin-actions.test.ts`
Expected: FAIL — `createCity is not a function` (or similar export-not-found error)

- [ ] **Step 3: Write the implementation**

Append to `src/actions/admin-actions.ts`:
```ts
const citySchema = z.object({
  name: z.string().min(2, 'Informe o nome da cidade.'),
  state: z.string().length(2, 'Use a sigla do estado (ex: PR).'),
  active: z.boolean(),
  comingSoon: z.boolean(),
})

type CityInput = z.infer<typeof citySchema>
type CityResult = { ok: true; cityId: string } | { ok: false; error: string }

export async function createCity(input: CityInput): Promise<CityResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = citySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const state = parsed.data.state.toUpperCase()

  const existing = await prisma.city.findFirst({ where: { name: parsed.data.name, state } })
  if (existing) {
    return { ok: false, error: 'Esta cidade já existe.' }
  }

  const city = await prisma.city.create({
    data: { name: parsed.data.name, state, active: parsed.data.active, comingSoon: parsed.data.comingSoon },
  })

  return { ok: true, cityId: city.id }
}

export async function updateCity(
  id: string,
  input: CityInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = citySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.city.findUnique({ where: { id } })
  if (!existing) {
    return { ok: false, error: 'Cidade não encontrada.' }
  }

  await prisma.city.update({
    where: { id },
    data: {
      name: parsed.data.name,
      state: parsed.data.state.toUpperCase(),
      active: parsed.data.active,
      comingSoon: parsed.data.comingSoon,
    },
  })

  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- admin-actions.test.ts`
Expected: PASS (19 tests — 13 from Tasks 2-3 plus 6 new)

- [ ] **Step 5: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts
git commit -m "Add city create and update actions"
```

---

### Task 5: Admin dashboard page

**Files:**
- Modify: `src/app/admin/page.tsx` (replace the placeholder)

**Interfaces:**
- Consumes: `getPlatformStats`, `getBusinessesForAdmin` from `@/lib/admin`.
- Produces: the real `/admin` page. No later task consumes new exports here.

- [ ] **Step 1: Wire the real dashboard page**

Replace the contents of `src/app/admin/page.tsx`:
```tsx
import Link from 'next/link'
import { getPlatformStats, getBusinessesForAdmin } from '@/lib/admin'

export default async function AdminDashboardPage() {
  const [stats, pendingBusinesses] = await Promise.all([
    getPlatformStats(),
    getBusinessesForAdmin('PENDING'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Visão geral</h1>
        <p className="text-sm text-neutral-500">Acompanhe o crescimento da plataforma.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Usuários</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Empresas ativas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.activeBusinesses}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Aguardando aprovação</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pendingBusinesses}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Ofertas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalOffers}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Cidades</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalCities}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Total de empresas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{stats.totalBusinesses}</p>
        </div>
      </div>

      {pendingBusinesses.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900">Empresas aguardando aprovação</h2>
            <Link href="/admin/empresas?status=PENDING" className="text-xs font-bold text-brand-green">
              Ver todas
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {pendingBusinesses.slice(0, 5).map((business) => (
              <div
                key={business.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-bold text-neutral-900">{business.name}</p>
                  <p className="text-xs text-neutral-500">
                    {business.city} - {business.state} · {business.category.name}
                  </p>
                </div>
                <Link href="/admin/empresas?status=PENDING" className="text-xs font-bold text-brand-green">
                  Revisar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds and renders**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Log in via the curl+cookie-jar technique used in the Comerciante-Panel plan (CSRF token + POST to `/api/auth/callback/credentials`), but as the seeded admin: `admin@akiofertas.com.br` / `admin123` (from the Foundation plan's seed script). Then `curl -s -b cookies.txt http://localhost:3000/admin` and confirm the response contains "Visão geral" and at least one numeric stat. Delete the cookie jar file when done.
Stop the dev server.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests from Tasks 1-4 plus every prior plan's test pass (7 + 19 = 26 new, on top of the 99 tests already on `master` when this plan's branch forked — report the actual total, don't guess it).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "Add real admin dashboard with platform stats"
```

---

### Task 6: Empresas page with approve/reject/suspend actions

**Files:**
- Create: `src/components/admin/BusinessStatusActions.tsx`, `src/app/admin/empresas/page.tsx`

**Interfaces:**
- Consumes: `getBusinessesForAdmin` from `@/lib/admin`, `updateBusinessStatus` from `@/actions/admin-actions`.
- Produces: `/admin/empresas` route with `?status=` filtering. No later task consumes new exports here.

- [ ] **Step 1: Write the status action buttons**

Create `src/components/admin/BusinessStatusActions.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBusinessStatus } from '@/actions/admin-actions'

export function BusinessStatusActions({ businessId, status }: { businessId: string; status: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function changeStatus(newStatus: 'ACTIVE' | 'SUSPENDED' | 'REJECTED') {
    setPending(true)
    setError(null)
    try {
      const result = await updateBusinessStatus(businessId, newStatus)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status === 'PENDING' && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => changeStatus('ACTIVE')}
              className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Aprovar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => changeStatus('REJECTED')}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600 disabled:opacity-50"
            >
              Reprovar
            </button>
          </>
        )}
        {status === 'ACTIVE' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus('SUSPENDED')}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
          >
            Suspender
          </button>
        )}
        {(status === 'SUSPENDED' || status === 'REJECTED') && (
          <button
            type="button"
            disabled={pending}
            onClick={() => changeStatus('ACTIVE')}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Reativar
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire the empresas page**

Create `src/app/admin/empresas/page.tsx`:
```tsx
import Link from 'next/link'
import { getBusinessesForAdmin } from '@/lib/admin'
import { BusinessStatusActions } from '@/components/admin/BusinessStatusActions'
import type { BusinessStatus } from '@prisma/client'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando aprovação',
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  REJECTED: 'Reprovada',
}

const FILTERS: { value: BusinessStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Todas' },
  { value: 'PENDING', label: 'Aguardando' },
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'SUSPENDED', label: 'Suspensas' },
  { value: 'REJECTED', label: 'Reprovadas' },
]

export default async function AdminEmpresasPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const status = searchParams.status as BusinessStatus | undefined
  const businesses = await getBusinessesForAdmin(status)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Empresas</h1>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/empresas?status=${filter.value}` : '/admin/empresas'}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              status === filter.value ? 'bg-brand-navy text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {businesses.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma empresa encontrada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {businesses.map((business) => (
            <div
              key={business.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-bold text-neutral-900">{business.name}</p>
                <p className="text-xs text-neutral-500">
                  {business.category.name} · {business.city} - {business.state}
                </p>
                <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                  {STATUS_LABEL[business.status]}
                </span>
              </div>
              <BusinessStatusActions businessId={business.id} status={business.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify with the seeded businesses**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Log in as the seeded admin (same curl+cookie-jar technique as Task 5). `curl -s -b cookies.txt http://localhost:3000/admin/empresas` and confirm the response contains "Big Burger" (the seeded, already-`ACTIVE` business — from the Foundation plan) and "Ativa". `curl -s -b cookies.txt "http://localhost:3000/admin/empresas?status=PENDING"` and confirm the filter chip row reflects the selection (the "Aguardando" chip should carry the active-filter class). Delete the cookie jar when done.
Stop the dev server.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BusinessStatusActions.tsx "src/app/admin/empresas/page.tsx"
git commit -m "Add empresas page with approve, reject, and suspend actions"
```

---

### Task 7: Categorias pages

**Files:**
- Create: `src/components/admin/CategoryForm.tsx`, `src/app/admin/categorias/page.tsx`, `src/app/admin/categorias/nova/page.tsx`, `src/app/admin/categorias/[id]/page.tsx`

**Interfaces:**
- Consumes: `getAllCategories`, `getCategoryById` from `@/lib/admin`, `createCategory`, `updateCategory` from `@/actions/admin-actions`.
- Produces: `/admin/categorias`, `/admin/categorias/nova`, `/admin/categorias/[id]` routes. No later task consumes new exports here.

- [ ] **Step 1: Write the shared category form**

Create `src/components/admin/CategoryForm.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCategory, updateCategory } from '@/actions/admin-actions'

type Values = {
  name: string
  icon: string
  order: string
  active: boolean
}

export function CategoryForm({
  categoryId,
  initialValues,
}: {
  categoryId?: string
  initialValues?: Values
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(initialValues ?? { name: '', icon: '', order: '0', active: true })
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
      const result = categoryId ? await updateCategory(categoryId, values) : await createCategory(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/categorias')
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
        Ícone
        <input
          value={values.icon}
          onChange={(e) => update('icon', e.target.value)}
          className={inputClass}
          placeholder="utensils, coffee, scissors..."
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Ordem
        <input
          type="number"
          min="0"
          value={values.order}
          onChange={(e) => update('order', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.active} onChange={(e) => update('active', e.target.checked)} />
        Ativa
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : categoryId ? 'Salvar alterações' : 'Criar categoria'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Wire the categorias list page**

Create `src/app/admin/categorias/page.tsx`:
```tsx
import Link from 'next/link'
import { getAllCategories } from '@/lib/admin'

export default async function AdminCategoriasPage() {
  const categories = await getAllCategories()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Categorias</h1>
        <Link
          href="/admin/categorias/nova"
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
        >
          + Nova categoria
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Ícone</th>
              <th className="px-4 py-2">Ordem</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">{category.name}</td>
                <td className="px-4 py-3 text-neutral-600">{category.icon}</td>
                <td className="px-4 py-3 text-neutral-600">{category.order}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      category.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {category.active ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/categorias/${category.id}`} className="text-xs font-bold text-brand-green">
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

- [ ] **Step 3: Wire the new-category page**

Create `src/app/admin/categorias/nova/page.tsx`:
```tsx
import { CategoryForm } from '@/components/admin/CategoryForm'

export default function NovaCategoriaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Nova categoria</h1>
      <CategoryForm />
    </div>
  )
}
```

- [ ] **Step 4: Wire the edit-category page**

Create `src/app/admin/categorias/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getCategoryById } from '@/lib/admin'
import { CategoryForm } from '@/components/admin/CategoryForm'

export default async function EditarCategoriaPage({ params }: { params: { id: string } }) {
  const category = await getCategoryById(params.id)
  if (!category) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar categoria</h1>
      <CategoryForm
        categoryId={category.id}
        initialValues={{
          name: category.name,
          icon: category.icon,
          order: String(category.order),
          active: category.active,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify it builds and renders**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Log in as the seeded admin. `curl -s -b cookies.txt http://localhost:3000/admin/categorias` and confirm the response contains a seeded category name (e.g. "Restaurantes e Lanchonetes" — from the Foundation plan's seed). `curl -s -b cookies.txt http://localhost:3000/admin/categorias/nova` and confirm it returns 200 with a form. Delete the cookie jar when done.
Stop the dev server.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/CategoryForm.tsx "src/app/admin/categorias"
git commit -m "Add categorias list, create, and edit pages"
```

---

### Task 8: Cidades pages

**Files:**
- Create: `src/components/admin/CityForm.tsx`, `src/app/admin/cidades/page.tsx`, `src/app/admin/cidades/nova/page.tsx`, `src/app/admin/cidades/[id]/page.tsx`

**Interfaces:**
- Consumes: `getAllCities`, `getCityById` from `@/lib/admin`, `createCity`, `updateCity` from `@/actions/admin-actions`.
- Produces: `/admin/cidades`, `/admin/cidades/nova`, `/admin/cidades/[id]` routes. Terminal for the cidades feature — nothing later in this plan depends on it, but note for future plans: `getActiveCities` (consumer-app plan) will start returning any city this task's admin marks `active: true`, immediately affecting the onboarding city picker and the merchant signup/profile city selects (both already built in earlier plans, both already fetch live).

- [ ] **Step 1: Write the shared city form**

Create `src/components/admin/CityForm.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCity, updateCity } from '@/actions/admin-actions'

type Values = {
  name: string
  state: string
  active: boolean
  comingSoon: boolean
}

export function CityForm({
  cityId,
  initialValues,
}: {
  cityId?: string
  initialValues?: Values
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>(
    initialValues ?? { name: '', state: '', active: true, comingSoon: false },
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
      const result = cityId ? await updateCity(cityId, values) : await createCity(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/cidades')
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
        Cidade
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        UF
        <input
          maxLength={2}
          value={values.state}
          onChange={(e) => update('state', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.active} onChange={(e) => update('active', e.target.checked)} />
        Ativa
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <input type="checkbox" checked={values.comingSoon} onChange={(e) => update('comingSoon', e.target.checked)} />
        Em breve
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : cityId ? 'Salvar alterações' : 'Criar cidade'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Wire the cidades list page**

Create `src/app/admin/cidades/page.tsx`:
```tsx
import Link from 'next/link'
import { getAllCities } from '@/lib/admin'

export default async function AdminCidadesPage() {
  const cities = await getAllCities()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Cidades</h1>
        <Link href="/admin/cidades/nova" className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white">
          + Nova cidade
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Cidade</th>
              <th className="px-4 py-2">UF</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => (
              <tr key={city.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">{city.name}</td>
                <td className="px-4 py-3 text-neutral-600">{city.state}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      city.active
                        ? 'bg-emerald-100 text-emerald-700'
                        : city.comingSoon
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {city.active ? 'Ativa' : city.comingSoon ? 'Em breve' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/cidades/${city.id}`} className="text-xs font-bold text-brand-green">
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

- [ ] **Step 3: Wire the new-city page**

Create `src/app/admin/cidades/nova/page.tsx`:
```tsx
import { CityForm } from '@/components/admin/CityForm'

export default function NovaCidadePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Nova cidade</h1>
      <CityForm />
    </div>
  )
}
```

- [ ] **Step 4: Wire the edit-city page**

Create `src/app/admin/cidades/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getCityById } from '@/lib/admin'
import { CityForm } from '@/components/admin/CityForm'

export default async function EditarCidadePage({ params }: { params: { id: string } }) {
  const city = await getCityById(params.id)
  if (!city) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar cidade</h1>
      <CityForm
        cityId={city.id}
        initialValues={{
          name: city.name,
          state: city.state,
          active: city.active,
          comingSoon: city.comingSoon,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify it builds and renders**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Log in as the seeded admin. `curl -s -b cookies.txt http://localhost:3000/admin/cidades` and confirm the response contains "Marmeleiro" and "Curitiba" (from the Foundation plan's seed — Curitiba is seeded `active: false, comingSoon: true`, so also confirm "Em breve" appears in the response). Delete the cookie jar when done.
Stop the dev server.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/CityForm.tsx "src/app/admin/cidades"
git commit -m "Add cidades list, create, and edit pages"
```

---

### Task 9: Make the two static merchant pages that read categories/cities dynamic

**Files:**
- Modify: `src/app/comerciante/cadastro/page.tsx`, `src/app/comerciante/ofertas/nova/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task only changes rendering mode. Terminal task for this plan.

**Why this task exists:** the Comerciante-Panel plan's final review flagged that `/comerciante/cadastro` and `/comerciante/ofertas/nova` get statically prerendered at build time (confirmed in that plan's build output as `○ (Static)`), because neither page calls anything that forces dynamic rendering (unlike pages that call `auth()` or `cookies()`). Both pages call `getActiveCategories()` (and `/comerciante/cadastro` also calls `getActiveCities()`), so their dropdowns are frozen with whatever categories/cities existed at the last build. That review explicitly deferred the fix to "when admin category CRUD ships" — this task, now.

- [ ] **Step 1: Force dynamic rendering on the signup page**

In `src/app/comerciante/cadastro/page.tsx`, add this line right after the imports, before the component:
```ts
export const dynamic = 'force-dynamic'
```

- [ ] **Step 2: Force dynamic rendering on the new-offer page**

In `src/app/comerciante/ofertas/nova/page.tsx`, add the same line right after the imports, before the component:
```ts
export const dynamic = 'force-dynamic'
```

- [ ] **Step 3: Verify the build output changed**

Run: `npm run build`
Expected: exit 0. Check the route table in the build output — `/comerciante/cadastro` and `/comerciante/ofertas/nova` should now be marked `ƒ` (Dynamic), not `○` (Static).

- [ ] **Step 4: Run the full test suite and final verification**

Run: `npm run test` — record the final total test count.
Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run build` — expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/comerciante/cadastro/page.tsx src/app/comerciante/ofertas/nova/page.tsx
git commit -m "Force dynamic rendering on pages that read live category/city data"
```

---

## What this plan does not cover

Admin user management (`/admin/usuarios` — search, block, unblock consumer/merchant accounts, per spec section 25) and plan/pricing management (`/admin/planos`) are both out of scope for this plan; their `DashboardShell` nav links already exist (from the Foundation plan) and will 404 until a future plan builds them, matching the same accepted pattern already established for the consumer app's `/cupons`/`/favoritos`/`/perfil` and the comerciante panel's `/comerciante/cupons/validar`/`/comerciante/plano`. Banners (`/admin/banners`, spec section 29) and analytics/growth charts (spec section 24's "Gráficos") are explicitly deferred past this plan too — the dashboard here shows only simple counts, no time-series data, since no `AnalyticsEvent` writer exists yet (that's the design doc's step 8, a later plan). Coupon validation and generation (`/comerciante/cupons/validar`, `/cupons`) remain the `coupons-and-plans` plan's job, per every prior plan's own deferred-scope notes.
