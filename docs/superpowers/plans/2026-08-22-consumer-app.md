# Consumer App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the consumer-facing browsing experience — home feed, category grid, location onboarding, filterable offer list, offer detail, and store page — all reading real data from the database seeded by the Foundation plan.

**Architecture:** Server Components query the database directly through small, independently-testable query functions in `src/lib/`. A location cookie (set by an onboarding flow) carries the user's coordinates or manually-picked city across requests; Server Components read it via `next/headers` and pass it into the query functions to sort/filter by distance. No client-side state management — filtering happens via URL query params and full navigations, matching Next.js App Router idioms.

**Tech Stack:** Next.js 14 App Router (Server Components), Prisma (already configured against Neon Postgres by the Foundation plan), Vitest for unit tests, Tailwind CSS.

## Global Constraints

- Consumer routes are mobile-first — from `docs/superpowers/specs/2026-08-21-aki-ofertas-mvp-design.md`.
- Brand name throughout code and copy is "Aki Ofertas" (not AquiPerto).
- Distance is computed with the Haversine formula already implemented in `src/lib/geo.ts` (`distanceKm`, `formatDistance`) — no PostGIS, no new distance math.
- This plan does not implement coupon generation. The offer detail page's "Usar cupom" affordance is a disabled placeholder that explains the feature is coming — real coupon issuance is a separate, later plan (`coupons-and-plans`), matching the Foundation plan's suggested build order.
- This plan builds entirely on top of the Foundation plan (`docs/superpowers/plans/2026-08-21-foundation.md`, already merged to `master`) — `prisma`, `ConsumerShell`, `hashPassword`/`verifyPassword`, `generateCouponCode`, `distanceKm`/`formatDistance` all already exist and must be reused, not reimplemented.

---

## File structure this plan produces

```
src/
  lib/
    location.ts                 # geo/city cookie parsing (pure functions)
    __tests__/
      location.test.ts
    categories.ts                # getActiveCategories, getActiveCities
    __tests__/
      categories.test.ts
    offers.ts                    # toOfferListItem, getFeaturedOffers, getOffersList, getOfferBySlug
    __tests__/
      offers.test.ts
    businesses.ts                 # getBusinessBySlug
    __tests__/
      businesses.test.ts
  components/
    offers/
      OfferCard.tsx
    categories/
      CategoryGrid.tsx
    onboarding/
      LocationGate.tsx
    stores/
      StoreTabs.tsx
  app/
    (consumer)/
      page.tsx                   # rewritten: real home feed
      ofertas/
        page.tsx                 # inside the group: keeps the bottom-nav shell
    onboarding/
      page.tsx                   # outside the group: full-screen, no bottom nav
    oferta/
      [slug]/
        page.tsx                 # outside the group: full-screen detail, no bottom nav
    loja/
      [slug]/
        page.tsx                 # outside the group: full-screen detail, no bottom nav
```

---

### Task 1: Location cookie utilities

**Files:**
- Create: `src/lib/location.ts`
- Test: `src/lib/__tests__/location.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Coordinates = { lat: number; lng: number }`, `GEO_COOKIE = 'aki_geo'`, `CITY_COOKIE = 'aki_city'`, `parseGeoCookie(value: string | undefined | null): Coordinates | null`, `serializeGeoCookie(coords: Coordinates): string`. Task 3's query functions take `Coordinates | null` using this exact type. Task 6's `LocationGate` writes cookies using `GEO_COOKIE`/`CITY_COOKIE`/`serializeGeoCookie`. Tasks 5, 7, 8 read cookies server-side using `GEO_COOKIE`/`CITY_COOKIE`/`parseGeoCookie`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/location.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseGeoCookie, serializeGeoCookie } from '@/lib/location'

describe('parseGeoCookie', () => {
  it('parses a valid "lat,lng" string', () => {
    expect(parseGeoCookie('-25.9006,-53.0489')).toEqual({ lat: -25.9006, lng: -53.0489 })
  })

  it('returns null for undefined', () => {
    expect(parseGeoCookie(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(parseGeoCookie(null)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseGeoCookie('')).toBeNull()
  })

  it('returns null for a malformed value', () => {
    expect(parseGeoCookie('not-a-coordinate')).toBeNull()
  })
})

describe('serializeGeoCookie', () => {
  it('round-trips through parseGeoCookie', () => {
    const coords = { lat: -25.4284, lng: -49.2733 }
    expect(parseGeoCookie(serializeGeoCookie(coords))).toEqual(coords)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- location.test.ts`
Expected: FAIL — `Cannot find module '@/lib/location'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/location.ts`:
```ts
export type Coordinates = { lat: number; lng: number }

export const GEO_COOKIE = 'aki_geo'
export const CITY_COOKIE = 'aki_city'

export function parseGeoCookie(value: string | undefined | null): Coordinates | null {
  if (!value) return null
  const parts = value.split(',')
  if (parts.length !== 2) return null

  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  return { lat, lng }
}

export function serializeGeoCookie(coords: Coordinates): string {
  return `${coords.lat},${coords.lng}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- location.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/location.ts src/lib/__tests__/location.test.ts
git commit -m "Add location cookie parsing utilities"
```

---

### Task 2: Reference data queries — categories and cities

**Files:**
- Create: `src/lib/categories.ts`
- Test: `src/lib/__tests__/categories.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `getActiveCategories(): Promise<{ id: string; name: string; icon: string; order: number }[]>` and `getActiveCities(): Promise<{ id: string; name: string; state: string }[]>` — used by Task 5 (home page category grid) and Task 6 (onboarding manual city picker).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/categories.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActiveCategories, getActiveCities } from '@/lib/categories'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    category: { findMany: vi.fn() },
    city: { findMany: vi.fn() },
  },
}))

describe('getActiveCategories', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries only active categories ordered by their order field', async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      { id: 'cat-1', name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1, active: true },
    ] as never)

    const result = await getActiveCategories()

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
    expect(result).toEqual([
      { id: 'cat-1', name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1, active: true },
    ])
  })
})

describe('getActiveCities', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries only active cities ordered by name', async () => {
    vi.mocked(prisma.city.findMany).mockResolvedValue([
      { id: 'city-1', name: 'Marmeleiro', state: 'PR', active: true, comingSoon: false },
    ] as never)

    const result = await getActiveCities()

    expect(prisma.city.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
    expect(result).toEqual([
      { id: 'city-1', name: 'Marmeleiro', state: 'PR', active: true, comingSoon: false },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- categories.test.ts`
Expected: FAIL — `Cannot find module '@/lib/categories'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/categories.ts`:
```ts
import { prisma } from '@/lib/db'

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
  })
}

export async function getActiveCities() {
  return prisma.city.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- categories.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/__tests__/categories.test.ts
git commit -m "Add active categories and cities queries"
```

---

### Task 3: Offer list and detail queries

**Files:**
- Create: `src/lib/offers.ts`
- Test: `src/lib/__tests__/offers.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `distanceKm`/`formatDistance` from `@/lib/geo`, `Coordinates` from `@/lib/location`.
- Produces:
  - `type OfferRow = { id: string; slug: string; title: string; imageUrl: string | null; originalPrice: number; discountPrice: number; discountPercent: number; createdAt: Date }`
  - `type BusinessRow = { id: string; name: string; slug: string; city: string; state: string; lat: number; lng: number }`
  - `type OfferListItem = { id: string; slug: string; title: string; imageUrl: string | null; originalPrice: number; discountPrice: number; discountPercent: number; businessName: string; businessSlug: string; distanceKm: number | null; distanceLabel: string | null }`
  - `toOfferListItem(offer: OfferRow, business: BusinessRow, location: Coordinates | null): OfferListItem` — reused by Task 4.
  - `getFeaturedOffers(input: { location: Coordinates | null; limit: number }): Promise<OfferListItem[]>`
  - `getOffersList(input: { categoryId?: string; location: Coordinates | null; radiusKm?: number }): Promise<OfferListItem[]>`
  - `type OfferDetail = { id: string; slug: string; title: string; description: string | null; imageUrl: string | null; originalPrice: number; discountPrice: number; discountPercent: number; quantityAvailable: number | null; startDate: Date; endDate: Date; business: { name: string; slug: string; whatsapp: string | null; city: string; state: string } }`
  - `getOfferBySlug(slug: string): Promise<OfferDetail | null>`
  - Used by Task 4 (`toOfferListItem`), Task 5 (`getFeaturedOffers`), Task 7 (`getOffersList`), Task 8 (`getOfferBySlug`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/offers.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFeaturedOffers, getOffersList, getOfferBySlug, toOfferListItem } from '@/lib/offers'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    offer: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

const bigBurger = { id: 'biz-1', name: 'Big Burger', slug: 'big-burger', city: 'Marmeleiro', state: 'PR', lat: -25.9006, lng: -53.0489 }
const farBusiness = { id: 'biz-2', name: 'Distant Pizza', slug: 'distant-pizza', city: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733 }

const nearOffer = {
  id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', imageUrl: null,
  originalPrice: 4290, discountPrice: 2990, discountPercent: 30, createdAt: new Date('2026-01-01'),
  business: bigBurger,
}
const farOffer = {
  id: 'offer-2', slug: 'pizza-grande', title: 'Pizza Grande', imageUrl: null,
  originalPrice: 5990, discountPrice: 4490, discountPercent: 25, createdAt: new Date('2026-01-02'),
  business: farBusiness,
}

describe('toOfferListItem', () => {
  it('computes distance and label when a location is given', () => {
    const item = toOfferListItem(nearOffer, bigBurger, { lat: -25.9006, lng: -53.0489 })
    expect(item.distanceKm).toBeCloseTo(0, 5)
    expect(item.distanceLabel).toBe('0 m')
  })

  it('leaves distance null when no location is given', () => {
    const item = toOfferListItem(nearOffer, bigBurger, null)
    expect(item.distanceKm).toBeNull()
    expect(item.distanceLabel).toBeNull()
  })

  it('maps business name and slug onto the item', () => {
    const item = toOfferListItem(nearOffer, bigBurger, null)
    expect(item.businessName).toBe('Big Burger')
    expect(item.businessSlug).toBe('big-burger')
  })
})

describe('getFeaturedOffers', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sorts by distance ascending when a location is given', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getFeaturedOffers({ location: { lat: -25.9006, lng: -53.0489 }, limit: 10 })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer', 'pizza-grande'])
  })

  it('queries only ACTIVE offers ordered by createdAt desc when there is no location', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      }),
    )
    expect(result.map((o) => o.slug)).toEqual(['pizza-grande', 'combo-burguer'])
    expect(result[0].distanceKm).toBeNull()
  })

  it('respects the limit', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 1 })

    expect(result).toHaveLength(1)
  })
})

describe('getOffersList', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('passes categoryId through to the where clause when given', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([] as never)

    await getOffersList({ categoryId: 'cat-1', location: null })

    expect(prisma.offer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE', categoryId: 'cat-1' },
      }),
    )
  })

  it('filters out offers beyond radiusKm when a location and radius are given', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getOffersList({
      location: { lat: -25.9006, lng: -53.0489 },
      radiusKm: 5,
    })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer'])
  })

  it('keeps all offers when no radius is given, sorted by distance', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([farOffer, nearOffer] as never)

    const result = await getOffersList({ location: { lat: -25.9006, lng: -53.0489 } })

    expect(result.map((o) => o.slug)).toEqual(['combo-burguer', 'pizza-grande'])
  })
})

describe('getOfferBySlug', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no offer matches', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue(null as never)

    const result = await getOfferBySlug('does-not-exist')

    expect(result).toBeNull()
  })

  it('maps the offer and its business when found', async () => {
    vi.mocked(prisma.offer.findUnique).mockResolvedValue({
      id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', description: 'Pão, carne e queijo.',
      imageUrl: null, originalPrice: 4290, discountPrice: 2990, discountPercent: 30,
      quantityAvailable: null, startDate: new Date('2026-01-01'), endDate: new Date('2026-02-01'),
      business: { name: 'Big Burger', slug: 'big-burger', whatsapp: '5546999990000', city: 'Marmeleiro', state: 'PR' },
    } as never)

    const result = await getOfferBySlug('combo-burguer')

    expect(result).not.toBeNull()
    expect(result?.title).toBe('Combo Burguer')
    expect(result?.business.name).toBe('Big Burger')
    expect(prisma.offer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'combo-burguer' } }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- offers.test.ts`
Expected: FAIL — `Cannot find module '@/lib/offers'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/offers.ts`:
```ts
import { prisma } from '@/lib/db'
import { distanceKm, formatDistance } from '@/lib/geo'
import type { Coordinates } from '@/lib/location'

export type OfferRow = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  createdAt: Date
}

export type BusinessRow = {
  id: string
  name: string
  slug: string
  city: string
  state: string
  lat: number
  lng: number
}

export type OfferListItem = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  businessName: string
  businessSlug: string
  distanceKm: number | null
  distanceLabel: string | null
}

export function toOfferListItem(
  offer: OfferRow,
  business: BusinessRow,
  location: Coordinates | null,
): OfferListItem {
  const km = location ? distanceKm(location, { lat: business.lat, lng: business.lng }) : null

  return {
    id: offer.id,
    slug: offer.slug,
    title: offer.title,
    imageUrl: offer.imageUrl,
    originalPrice: offer.originalPrice,
    discountPrice: offer.discountPrice,
    discountPercent: offer.discountPercent,
    businessName: business.name,
    businessSlug: business.slug,
    distanceKm: km,
    distanceLabel: km === null ? null : formatDistance(km),
  }
}

export async function getFeaturedOffers(input: { location: Coordinates | null; limit: number }): Promise<OfferListItem[]> {
  const rows = await prisma.offer.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { business: true },
  })

  const items = rows.map((row) => toOfferListItem(row, row.business, input.location))

  if (input.location) {
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  return items.slice(0, input.limit)
}

export async function getOffersList(input: {
  categoryId?: string
  location: Coordinates | null
  radiusKm?: number
}): Promise<OfferListItem[]> {
  const rows = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { business: true },
  })

  let items = rows.map((row) => toOfferListItem(row, row.business, input.location))

  if (input.location) {
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  if (input.location && input.radiusKm) {
    items = items.filter((item) => item.distanceKm !== null && item.distanceKm <= input.radiusKm!)
  }

  return items
}

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
  business: {
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
  }
}

export async function getOfferBySlug(slug: string): Promise<OfferDetail | null> {
  const row = await prisma.offer.findUnique({
    where: { slug },
    include: { business: true },
  })

  if (!row) return null

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
    business: {
      name: row.business.name,
      slug: row.business.slug,
      whatsapp: row.business.whatsapp,
      city: row.business.city,
      state: row.business.state,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- offers.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/offers.ts src/lib/__tests__/offers.test.ts
git commit -m "Add offer list and detail query utilities"
```

---

### Task 4: Business detail query

**Files:**
- Create: `src/lib/businesses.ts`
- Test: `src/lib/__tests__/businesses.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `toOfferListItem` and `OfferListItem` from `@/lib/offers`.
- Produces: `type BusinessDetail = { id: string; slug: string; name: string; description: string | null; logoUrl: string | null; coverUrl: string | null; categoryName: string; city: string; state: string; phone: string | null; whatsapp: string | null; offers: OfferListItem[] }` and `getBusinessBySlug(slug: string): Promise<BusinessDetail | null>` — used by Task 9 (store page).

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/businesses.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBusinessBySlug } from '@/lib/businesses'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
  },
}))

describe('getBusinessBySlug', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no business matches', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null as never)

    const result = await getBusinessBySlug('does-not-exist')

    expect(result).toBeNull()
  })

  it('maps the business and its active offers when found', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: 'biz-1', slug: 'big-burger', name: 'Big Burger', description: 'Hambúrgueres artesanais.',
      logoUrl: null, coverUrl: null, city: 'Marmeleiro', state: 'PR', phone: null,
      whatsapp: '5546999990000', lat: -25.9006, lng: -53.0489,
      category: { name: 'Restaurantes e Lanchonetes' },
      offers: [
        {
          id: 'offer-1', slug: 'combo-burguer', title: 'Combo Burguer', imageUrl: null,
          originalPrice: 4290, discountPrice: 2990, discountPercent: 30, createdAt: new Date('2026-01-01'),
        },
      ],
    } as never)

    const result = await getBusinessBySlug('big-burger')

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Big Burger')
    expect(result?.categoryName).toBe('Restaurantes e Lanchonetes')
    expect(result?.offers).toHaveLength(1)
    expect(result?.offers[0].slug).toBe('combo-burguer')
    expect(prisma.business.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'big-burger' } }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- businesses.test.ts`
Expected: FAIL — `Cannot find module '@/lib/businesses'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/businesses.ts`:
```ts
import { prisma } from '@/lib/db'
import { toOfferListItem, type OfferListItem } from '@/lib/offers'

export type BusinessDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  categoryName: string
  city: string
  state: string
  phone: string | null
  whatsapp: string | null
  offers: OfferListItem[]
}

export async function getBusinessBySlug(slug: string): Promise<BusinessDetail | null> {
  const row = await prisma.business.findUnique({
    where: { slug },
    include: {
      category: true,
      offers: { where: { status: 'ACTIVE' } },
    },
  })

  if (!row) return null

  const businessRow = { id: row.id, name: row.name, slug: row.slug, city: row.city, state: row.state, lat: row.lat, lng: row.lng }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    categoryName: row.category.name,
    city: row.city,
    state: row.state,
    phone: row.phone,
    whatsapp: row.whatsapp,
    offers: row.offers.map((offer) => toOfferListItem(offer, businessRow, null)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- businesses.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/businesses.ts src/lib/__tests__/businesses.test.ts
git commit -m "Add business detail query with its active offers"
```

---

### Task 5: OfferCard, CategoryGrid, and the real home page

**Files:**
- Create: `src/components/offers/OfferCard.tsx`, `src/components/categories/CategoryGrid.tsx`
- Modify: `src/app/(consumer)/page.tsx`

**Interfaces:**
- Consumes: `OfferListItem` from `@/lib/offers`, `getFeaturedOffers` from `@/lib/offers`, `getActiveCategories` from `@/lib/categories`, `GEO_COOKIE`/`parseGeoCookie` from `@/lib/location`.
- Produces: `<OfferCard offer={item} />` (props: `{ offer: OfferListItem }`) and `<CategoryGrid categories={categories} />` (props: `{ categories: { id: string; name: string; icon: string }[] }`) — reused by Task 7 (offers list) and Task 5 itself (home).

- [ ] **Step 1: Write `OfferCard`**

Create `src/components/offers/OfferCard.tsx`:
```tsx
import Link from 'next/link'
import type { OfferListItem } from '@/lib/offers'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function OfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Link
      href={`/oferta/${offer.slug}`}
      className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-2"
    >
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {offer.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
        )}
        <span className="absolute left-1 top-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          -{offer.discountPercent}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-neutral-900">{offer.title}</h3>
        <p className="truncate text-xs text-neutral-500">{offer.businessName}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-xs text-neutral-400 line-through">{formatCents(offer.originalPrice)}</span>
          <span className="text-base font-bold text-emerald-600">{formatCents(offer.discountPrice)}</span>
        </div>
        {offer.distanceLabel && (
          <p className="mt-0.5 text-xs text-neutral-400">📍 {offer.distanceLabel}</p>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Write `CategoryGrid`**

Create `src/components/categories/CategoryGrid.tsx`:
```tsx
import Link from 'next/link'

export function CategoryGrid({
  categories,
}: {
  categories: { id: string; name: string; icon: string }[]
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/ofertas?categoria=${category.id}`}
          className="flex flex-col items-center gap-1 text-center"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-sm">
            {category.icon.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[10px] leading-tight text-neutral-600">{category.name}</span>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Wire the real home page**

Replace the contents of `src/app/(consumer)/page.tsx`:
```tsx
import { cookies } from 'next/headers'
import { getActiveCategories } from '@/lib/categories'
import { getFeaturedOffers } from '@/lib/offers'
import { GEO_COOKIE, parseGeoCookie } from '@/lib/location'
import { CategoryGrid } from '@/components/categories/CategoryGrid'
import { OfferCard } from '@/components/offers/OfferCard'

export default async function HomePage() {
  const location = parseGeoCookie(cookies().get(GEO_COOKIE)?.value)
  const [categories, offers] = await Promise.all([
    getActiveCategories(),
    getFeaturedOffers({ location, limit: 10 }),
  ])

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Aki Ofertas</h1>
        <p className="text-sm text-neutral-500">O que você precisa, pertinho de você.</p>
      </div>

      <CategoryGrid categories={categories} />

      <div>
        <h2 className="mb-2 text-sm font-bold text-neutral-900">Ofertas em destaque</h2>
        {offers.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma oferta disponível no momento.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify it builds and renders real data**

Run: `npm run build`
Expected: exit 0, no type errors.

Run: `npm run dev` in the background, `curl -s http://localhost:3000/` and confirm the response contains `Combo Burguer` (the seeded offer's title) and `Aki Ofertas`. Stop the dev server.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all tests from Tasks 1-4 plus every Foundation-plan test pass (16 + 6 + 2 + 11 + 2 = 37 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/offers/OfferCard.tsx src/components/categories/CategoryGrid.tsx "src/app/(consumer)/page.tsx"
git commit -m "Wire real home page with category grid and featured offers"
```

---

### Task 6: Location onboarding

**Files:**
- Create: `src/app/onboarding/page.tsx`, `src/components/onboarding/LocationGate.tsx`

**Interfaces:**
- Consumes: `getActiveCities` from `@/lib/categories`, `GEO_COOKIE`/`CITY_COOKIE`/`serializeGeoCookie` from `@/lib/location`.
- Produces: `/onboarding` route. `<LocationGate cities={cities} />` (props: `{ cities: { id: string; name: string; state: string }[] }`) is a client component — no later task consumes it directly, but it's the only place `GEO_COOKIE`/`CITY_COOKIE` get written, so Tasks 7/8 reading those cookies depend on this task existing.

- [ ] **Step 1: Write `LocationGate`**

Create `src/components/onboarding/LocationGate.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CITY_COOKIE, GEO_COOKIE, serializeGeoCookie } from '@/lib/location'

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`
}

export function LocationGate({
  cities,
}: {
  cities: { id: string; name: string; state: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState('')

  function handleActivateLocation() {
    setError(null)
    if (!navigator.geolocation) {
      setError('Seu navegador não suporta localização. Escolha sua cidade abaixo.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCookie(GEO_COOKIE, serializeGeoCookie({ lat: position.coords.latitude, lng: position.coords.longitude }))
        router.push('/')
      },
      () => {
        setError('Não conseguimos acessar sua localização. Escolha sua cidade abaixo.')
      },
    )
  }

  function handleManualCity() {
    if (!selectedCity) {
      setError('Escolha uma cidade.')
      return
    }
    setCookie(CITY_COOKIE, selectedCity)
    router.push('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Permita sua localização</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Assim podemos mostrar as melhores ofertas e estabelecimentos perto de você.
        </p>
      </div>

      <button
        type="button"
        onClick={handleActivateLocation}
        className="w-full max-w-xs rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
      >
        Ativar localização
      </button>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Ou escolha sua cidade</option>
          {cities.map((city) => (
            <option key={city.id} value={city.name}>
              {city.name} - {city.state}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleManualCity}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700"
        >
          Continuar com esta cidade
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={() => router.push('/')} className="text-sm text-neutral-400">
        Agora não
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire the onboarding page**

Create `src/app/onboarding/page.tsx`:
```tsx
import { getActiveCities } from '@/lib/categories'
import { LocationGate } from '@/components/onboarding/LocationGate'

export default async function OnboardingPage() {
  const cities = await getActiveCities()
  return <LocationGate cities={cities} />
}
```

- [ ] **Step 3: Verify it builds and renders**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/onboarding` (expect `200`). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding src/components/onboarding
git commit -m "Add location onboarding with geolocation and manual city fallback"
```

---

### Task 7: Offers list page with filters

**Files:**
- Create: `src/app/(consumer)/ofertas/page.tsx`

**Interfaces:**
- Consumes: `getOffersList` from `@/lib/offers`, `getActiveCategories` from `@/lib/categories`, `GEO_COOKIE`/`parseGeoCookie` from `@/lib/location`, `OfferCard` from `@/components/offers/OfferCard`.
- Produces: `/ofertas` route (inside the `(consumer)` route group, so it renders inside `ConsumerShell` with the bottom nav — route groups don't affect the URL, only which `layout.tsx` wraps the page) reading `?categoria=<id>` and `?raio=1|3|5|10|20` search params. No later task in this plan consumes this page directly.

- [ ] **Step 1: Write the offers list page**

Create `src/app/(consumer)/ofertas/page.tsx`:
```tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getActiveCategories } from '@/lib/categories'
import { getOffersList } from '@/lib/offers'
import { GEO_COOKIE, parseGeoCookie } from '@/lib/location'
import { OfferCard } from '@/components/offers/OfferCard'

const RADIUS_OPTIONS = [1, 3, 5, 10, 20]

function buildFilterHref(categoria: string | undefined, raio: number | undefined) {
  const params = new URLSearchParams()
  if (categoria) params.set('categoria', categoria)
  if (raio) params.set('raio', String(raio))
  const query = params.toString()
  return query ? `/ofertas?${query}` : '/ofertas'
}

export default async function OfertasPage({
  searchParams,
}: {
  searchParams: { categoria?: string; raio?: string }
}) {
  const location = parseGeoCookie(cookies().get(GEO_COOKIE)?.value)
  const radiusKm = searchParams.raio ? Number(searchParams.raio) : undefined

  const [categories, offers] = await Promise.all([
    getActiveCategories(),
    getOffersList({
      categoryId: searchParams.categoria,
      location,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
    }),
  ])

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold text-neutral-900">Ofertas perto de você</h1>

      <div className="flex gap-2 overflow-x-auto">
        <Link
          href={buildFilterHref(undefined, radiusKm)}
          className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
            !searchParams.categoria ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          Todas
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={buildFilterHref(category.id, radiusKm)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              searchParams.categoria === category.id ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {category.name}
          </Link>
        ))}
      </div>

      {location && (
        <div className="flex gap-2 overflow-x-auto">
          <Link
            href={buildFilterHref(searchParams.categoria, undefined)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs ${
              !radiusKm ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            Toda cidade
          </Link>
          {RADIUS_OPTIONS.map((km) => (
            <Link
              key={km}
              href={buildFilterHref(searchParams.categoria, km)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs ${
                radiusKm === km ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              Até {km} km
            </Link>
          ))}
        </div>
      )}

      {offers.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma oferta encontrada com esses filtros.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds and filters work**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ofertas` (expect `200`).
Run: `curl -s http://localhost:3000/ofertas` and confirm the response contains `Combo Burguer` (the seeded offer, since it has no category filter applied and the seed's offer category is "Restaurantes e Lanchonetes").
Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(consumer)/ofertas"
git commit -m "Add offers list page with category and radius filters"
```

---

### Task 8: Offer detail page

**Files:**
- Create: `src/app/oferta/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getOfferBySlug` from `@/lib/offers`.
- Produces: `/oferta/[slug]` route. No later task in this plan consumes this page directly.

- [ ] **Step 1: Write the offer detail page**

Create `src/app/oferta/[slug]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getOfferBySlug } from '@/lib/offers'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

export default async function OfertaPage({ params }: { params: { slug: string } }) {
  const offer = await getOfferBySlug(params.slug)

  if (!offer) {
    notFound()
  }

  return (
    <div className="flex flex-col">
      <div className="relative h-48 w-full bg-neutral-200">
        {offer.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" />
        )}
        <span className="absolute bottom-3 left-3 rounded-lg bg-red-500 px-3 py-1 text-lg font-bold text-white">
          -{offer.discountPercent}%
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-neutral-500">{offer.business.name}</p>
        <h1 className="text-xl font-bold text-neutral-900">{offer.title}</h1>
        {offer.description && <p className="text-sm text-neutral-600">{offer.description}</p>}

        <div className="flex items-baseline gap-2">
          <span className="text-base text-neutral-400 line-through">{formatCents(offer.originalPrice)}</span>
          <span className="text-2xl font-bold text-emerald-600">{formatCents(offer.discountPrice)}</span>
        </div>

        <p className="text-xs text-neutral-500">
          Válido até {formatDate(offer.endDate)}
          {offer.quantityAvailable !== null && ` · ${offer.quantityAvailable} disponíveis`}
        </p>

        <button
          type="button"
          disabled
          className="mt-2 w-full rounded-lg bg-neutral-200 px-4 py-3 text-sm font-bold text-neutral-500"
        >
          Usar cupom (em breve)
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds and renders**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/oferta/combo-burguer-big-burger` (expect `200` — this is the seeded offer's slug from the Foundation plan's seed script).
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/oferta/does-not-exist` (expect `404`).
Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/oferta
git commit -m "Add offer detail page"
```

---

### Task 9: Store page with Sobre/Ofertas tabs

**Files:**
- Create: `src/components/stores/StoreTabs.tsx`, `src/app/loja/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getBusinessBySlug` from `@/lib/businesses`, `OfferCard` from `@/components/offers/OfferCard`.
- Produces: `<StoreTabs about={ReactNode} ofertas={ReactNode} />` (props: `{ about: React.ReactNode; ofertas: React.ReactNode }`) and the `/loja/[slug]` route. Nothing later in this plan consumes these.

- [ ] **Step 1: Write `StoreTabs`**

Create `src/components/stores/StoreTabs.tsx`:
```tsx
'use client'

import { useState } from 'react'

export function StoreTabs({
  about,
  ofertas,
}: {
  about: React.ReactNode
  ofertas: React.ReactNode
}) {
  const [tab, setTab] = useState<'sobre' | 'ofertas'>('ofertas')

  return (
    <div>
      <div className="flex gap-4 border-b border-neutral-200 px-4">
        <button
          type="button"
          onClick={() => setTab('sobre')}
          className={`border-b-2 py-2 text-sm font-bold ${
            tab === 'sobre' ? 'border-emerald-600 text-neutral-900' : 'border-transparent text-neutral-400'
          }`}
        >
          Sobre
        </button>
        <button
          type="button"
          onClick={() => setTab('ofertas')}
          className={`border-b-2 py-2 text-sm font-bold ${
            tab === 'ofertas' ? 'border-emerald-600 text-neutral-900' : 'border-transparent text-neutral-400'
          }`}
        >
          Ofertas
        </button>
      </div>
      <div className="p-4">{tab === 'sobre' ? about : ofertas}</div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the store page**

Create `src/app/loja/[slug]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getBusinessBySlug } from '@/lib/businesses'
import { OfferCard } from '@/components/offers/OfferCard'
import { StoreTabs } from '@/components/stores/StoreTabs'

export default async function LojaPage({ params }: { params: { slug: string } }) {
  const business = await getBusinessBySlug(params.slug)

  if (!business) {
    notFound()
  }

  const aboutContent = (
    <div className="flex flex-col gap-2 text-sm text-neutral-600">
      <p>{business.description ?? 'Este estabelecimento ainda não adicionou uma descrição.'}</p>
      <p>
        <span className="font-bold text-neutral-900">Endereço: </span>
        {business.city} - {business.state}
      </p>
      {business.whatsapp && (
        <p>
          <span className="font-bold text-neutral-900">WhatsApp: </span>
          {business.whatsapp}
        </p>
      )}
    </div>
  )

  const offersContent =
    business.offers.length === 0 ? (
      <p className="text-sm text-neutral-500">Nenhuma oferta ativa no momento.</p>
    ) : (
      <div className="flex flex-col gap-2">
        {business.offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    )

  return (
    <div className="flex flex-col">
      <div className="relative h-32 w-full bg-neutral-800">
        {business.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.coverUrl} alt={business.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute bottom-3 left-4 text-white">
          <h1 className="text-lg font-bold">{business.name}</h1>
          <p className="text-xs text-neutral-200">{business.categoryName}</p>
        </div>
      </div>
      <StoreTabs about={aboutContent} ofertas={offersContent} />
    </div>
  )
}
```

- [ ] **Step 3: Verify it builds and renders**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/loja/big-burger` (expect `200` — this is the seeded business's slug).
Run: `curl -s http://localhost:3000/loja/big-burger` and confirm the response contains `Big Burger` and `Restaurantes e Lanchonetes`.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/loja/does-not-exist` (expect `404`).
Stop the dev server.

- [ ] **Step 4: Run the full test suite and final verification**

Run: `npm run test` — expect all 37 tests still passing.
Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no errors.
Run: `npm run build` — expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/stores src/app/loja
git commit -m "Add store page with Sobre/Ofertas tabs"
```

---

## What this plan does not cover

Coupon generation and redemption (the "Usar cupom" button stays disabled), merchant business signup and offer CRUD, admin approval workflows, and plan/subscription management are built in the `comerciante-panel`, `admin-panel`, and `coupons-and-plans` plans that follow, per the design doc's suggested build order (steps 4-9). The consumer pages `/cadastro` (signup form — the `signUpConsumer` action it needs already exists from the Foundation plan), `/cupons` (my coupons list), `/favoritos`, and `/perfil` are deferred to the `coupons-and-plans` plan, since they depend on data (coupons, favorites) this plan doesn't create yet. The map view (`/mapa`, spec section 8) and full-text/keyword search beyond category filtering are explicitly deferred past the MVP per the design doc.
