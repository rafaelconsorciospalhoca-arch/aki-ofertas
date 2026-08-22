# Aki Ofertas — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js project, database schema, seed data, and role-based auth/routing skeleton that every later feature (consumer app, comerciante panel, admin panel, coupons, plans) will build on top of.

**Architecture:** Single Next.js 14 App Router project in TypeScript. Three route areas — `(consumer)`, `comerciante`, `admin` — each with its own layout shell, gated by a shared middleware that reads role from the Auth.js session. One PostgreSQL database (Neon) accessed through a single Prisma client.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL (Neon), Auth.js v5 (`next-auth@beta`) with Credentials provider, bcryptjs, Zod, Vitest for unit tests.

## Global Constraints

- Consumer routes are mobile-first; comerciante/admin routes are responsive dashboards (desktop and mobile browser), not native apps — from `docs/superpowers/specs/2026-08-21-aki-ofertas-mvp-design.md`.
- No secrets hardcoded — every credential goes through `.env` and is documented in `.env.example`.
- Passwords are hashed with bcrypt, never stored or logged in plain text.
- Every Server Action re-checks the session role server-side — never trust a client-side role check alone.
- Coupon codes use the `AK` prefix (matches the Aki Ofertas brand), not `AP`.
- Brand name throughout code, copy, and seed data is "Aki Ofertas" (not AquiPerto).

---

## File structure this plan produces

```
aki-ofertas/
  prisma/
    schema.prisma
    seed.ts
  src/
    lib/
      db.ts               # Prisma client singleton
      auth.ts              # Auth.js config (providers, session callback)
      password.ts          # hash/verify helpers
      coupon-code.ts        # coupon code generator
      geo.ts                # Haversine distance helper
      __tests__/
        password.test.ts
        coupon-code.test.ts
        geo.test.ts
    actions/
      auth-actions.ts       # signUpConsumer server action
      __tests__/
        auth-actions.test.ts
    components/
      layout/
        ConsumerShell.tsx
        DashboardShell.tsx
    app/
      (consumer)/
        layout.tsx
        page.tsx             # placeholder home, replaced by the consumer-app plan
      comerciante/
        layout.tsx
        page.tsx             # placeholder dashboard, replaced by the comerciante plan
      admin/
        layout.tsx
        page.tsx             # placeholder dashboard, replaced by the admin plan
      entrar/
        page.tsx             # shared login page (all three roles)
    middleware.ts
  .env.example
  vitest.config.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css`, `vitest.config.ts`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: a runnable `npm run dev` Next.js app and a runnable `npm run test` Vitest suite that later tasks add tests into.

- [ ] **Step 1: Scaffold Next.js with TypeScript and Tailwind**

Run:
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-git
```
Answer "No" to Turbopack if prompted (keep webpack for now — fewer surprises with Prisma).

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install prisma @prisma/client next-auth@beta bcryptjs zod
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths @types/bcryptjs
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `.env.example`**

```bash
DATABASE_URL="postgresql://user:password@host/aki_ofertas?sslmode=require"
AUTH_SECRET="generate-with: npx auth secret"
BLOB_READ_WRITE_TOKEN=""
```

- [ ] **Step 5: Verify the scaffold runs**

Run: `npm run dev` in the background, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` (expect `200`), then stop the dev server.

Run: `npm run test` — expect it to pass with "No test files found" (no tests yet).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js project with Tailwind, Prisma, Auth.js and Vitest"
```

---

### Task 2: Prisma schema and database connection

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env`
- Produces: `import { prisma } from '@/lib/db'` — a singleton `PrismaClient`, used by every later task that touches the database. Model names below are the exact Prisma model names later tasks reference (`User`, `City`, `Category`, `Business`, `BusinessHours`, `Offer`, `Coupon`, `Favorite`, `Plan`, `Subscription`, `AnalyticsEvent`).

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CONSUMER
  MERCHANT
  ADMIN
}

enum BusinessStatus {
  PENDING
  ACTIVE
  SUSPENDED
  REJECTED
}

enum OfferStatus {
  DRAFT
  ACTIVE
  EXPIRED
  CANCELLED
}

enum CouponStatus {
  GENERATED
  USED
  EXPIRED
  CANCELLED
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  phone        String?
  passwordHash String
  role         Role     @default(CONSUMER)
  city         String?
  state        String?
  createdAt    DateTime @default(now())

  businesses Business[]
  coupons    Coupon[]
  favorites  Favorite[]

  @@map("users")
}

model City {
  id         String  @id @default(cuid())
  name       String
  state      String
  active     Boolean @default(true)
  comingSoon Boolean @default(false)

  @@unique([name, state])
  @@map("cities")
}

model Category {
  id     String  @id @default(cuid())
  name   String  @unique
  icon   String
  order  Int     @default(0)
  active Boolean @default(true)

  businesses Business[]
  offers     Offer[]

  @@map("categories")
}

model Business {
  id           String         @id @default(cuid())
  ownerId      String
  owner        User           @relation(fields: [ownerId], references: [id])
  name         String
  legalName    String?
  document     String?
  categoryId   String
  category     Category       @relation(fields: [categoryId], references: [id])
  phone        String?
  whatsapp     String?
  email        String?
  instagram    String?
  website      String?
  address      String
  number       String?
  neighborhood String?
  city         String
  state        String
  zip          String?
  lat          Float
  lng          Float
  description  String?
  logoUrl      String?
  coverUrl     String?
  status       BusinessStatus @default(PENDING)
  planId       String?
  plan         Plan?          @relation(fields: [planId], references: [id])
  createdAt    DateTime       @default(now())
  slug         String         @unique

  hours           BusinessHours[]
  offers          Offer[]
  coupons         Coupon[]
  favorites       Favorite[]
  subscriptions   Subscription[]
  analyticsEvents AnalyticsEvent[]

  @@map("businesses")
}

model BusinessHours {
  id         String   @id @default(cuid())
  businessId String
  business   Business @relation(fields: [businessId], references: [id])
  weekday    Int
  opensAt    String?
  closesAt   String?
  closed     Boolean  @default(false)

  @@map("business_hours")
}

model Offer {
  id                String      @id @default(cuid())
  businessId        String
  business          Business    @relation(fields: [businessId], references: [id])
  title             String
  description       String?
  imageUrl          String?
  originalPrice     Int
  discountPrice     Int
  discountPercent   Int
  categoryId        String
  category          Category    @relation(fields: [categoryId], references: [id])
  quantityAvailable Int?
  startDate         DateTime
  endDate           DateTime
  isFlash           Boolean     @default(false)
  status            OfferStatus @default(ACTIVE)
  createdAt         DateTime    @default(now())
  slug              String      @unique

  coupons   Coupon[]
  favorites Favorite[]

  @@map("offers")
}

model Coupon {
  id          String       @id @default(cuid())
  code        String       @unique
  userId      String
  user        User         @relation(fields: [userId], references: [id])
  offerId     String
  offer       Offer        @relation(fields: [offerId], references: [id])
  businessId  String
  business    Business     @relation(fields: [businessId], references: [id])
  status      CouponStatus @default(GENERATED)
  generatedAt DateTime     @default(now())
  usedAt      DateTime?
  expiresAt   DateTime

  @@map("coupons")
}

model Favorite {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  businessId String?
  business   Business? @relation(fields: [businessId], references: [id])
  offerId    String?
  offer      Offer?    @relation(fields: [offerId], references: [id])
  createdAt  DateTime  @default(now())

  @@unique([userId, businessId, offerId])
  @@map("favorites")
}

model Plan {
  id                String  @id @default(cuid())
  name              String  @unique
  priceCents        Int
  maxOffersPerMonth Int
  hasFlashOffers    Boolean @default(false)
  hasFullMetrics    Boolean @default(false)

  businesses    Business[]
  subscriptions Subscription[]

  @@map("plans")
}

model Subscription {
  id         String    @id @default(cuid())
  businessId String
  business   Business  @relation(fields: [businessId], references: [id])
  planId     String
  plan       Plan      @relation(fields: [planId], references: [id])
  status     String    @default("ACTIVE")
  startedAt  DateTime  @default(now())
  renewsAt   DateTime?

  @@map("subscriptions")
}

model AnalyticsEvent {
  id         String   @id @default(cuid())
  businessId String
  business   Business @relation(fields: [businessId], references: [id])
  offerId    String?
  type       String
  createdAt  DateTime @default(now())

  @@map("analytics_events")
}
```

- [ ] **Step 2: Write the Prisma client singleton**

Create `src/lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 3: Set the real `DATABASE_URL`**

Create a Neon project (or ask the user for an existing connection string), then create `.env` (not committed) with the real `DATABASE_URL` copied from `.env.example`'s shape.

- [ ] **Step 4: Run the first migration**

Run: `npx prisma migrate dev --name init`
Expected: migration succeeds and creates all tables listed above in the Neon database.

- [ ] **Step 5: Verify the client compiles**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/db.ts .env.example
git commit -m "Add Prisma schema and database client singleton"
```

---

### Task 3: Password hashing utility (TDD)

**Files:**
- Create: `src/lib/password.ts`
- Test: `src/lib/__tests__/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>` and `verifyPassword(plain: string, hash: string): Promise<boolean>` — used by Task 7's signup action and by the future login flow.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/password.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password hashing', () => {
  it('hashes a password to a different string', async () => {
    const hash = await hashPassword('supersecret123')
    expect(hash).not.toBe('supersecret123')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('supersecret123')
    await expect(verifyPassword('supersecret123', hash)).resolves.toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('supersecret123')
    await expect(verifyPassword('wrongpassword', hash)).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- password.test.ts`
Expected: FAIL — `Cannot find module '@/lib/password'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/password.ts`:
```ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- password.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts src/lib/__tests__/password.test.ts
git commit -m "Add password hashing utility"
```

---

### Task 4: Coupon code generator (TDD)

**Files:**
- Create: `src/lib/coupon-code.ts`
- Test: `src/lib/__tests__/coupon-code.test.ts`

**Interfaces:**
- Produces: `generateCouponCode(): string` — returns an `AK` + 6-uppercase-alphanumeric code (e.g. `AK25A582`), used by the coupon-generation feature in a later plan.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/coupon-code.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { generateCouponCode } from '@/lib/coupon-code'

describe('generateCouponCode', () => {
  it('starts with AK', () => {
    expect(generateCouponCode().startsWith('AK')).toBe(true)
  })

  it('is 8 characters long', () => {
    expect(generateCouponCode()).toHaveLength(8)
  })

  it('only contains uppercase letters and digits after the prefix', () => {
    const code = generateCouponCode()
    expect(code.slice(2)).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('generates different codes across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCouponCode()))
    expect(codes.size).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- coupon-code.test.ts`
Expected: FAIL — `Cannot find module '@/lib/coupon-code'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/coupon-code.ts`:
```ts
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateCouponCode(): string {
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `AK${suffix}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- coupon-code.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/coupon-code.ts src/lib/__tests__/coupon-code.test.ts
git commit -m "Add coupon code generator"
```

---

### Task 5: Distance calculation utility (TDD)

**Files:**
- Create: `src/lib/geo.ts`
- Test: `src/lib/__tests__/geo.test.ts`

**Interfaces:**
- Produces: `distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number` and `formatDistance(km: number): string` (e.g. `0.8` → `"800 m"`, `1.2` → `"1,2 km"`) — used by the offer-list ranking feature in the consumer-app plan.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/geo.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { distanceKm, formatDistance } from '@/lib/geo'

describe('distanceKm', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: -25.9, lng: -53.05 }
    expect(distanceKm(p, p)).toBeCloseTo(0, 5)
  })

  it('computes a known distance between two Brazilian cities within 1% tolerance', () => {
    // Curitiba to São Paulo, ~340 km great-circle distance
    const curitiba = { lat: -25.4284, lng: -49.2733 }
    const saoPaulo = { lat: -23.5505, lng: -46.6333 }
    const km = distanceKm(curitiba, saoPaulo)
    expect(km).toBeGreaterThan(330)
    expect(km).toBeLessThan(350)
  })
})

describe('formatDistance', () => {
  it('formats sub-kilometer distances in meters', () => {
    expect(formatDistance(0.8)).toBe('800 m')
  })

  it('formats kilometer distances with a comma decimal', () => {
    expect(formatDistance(1.2)).toBe('1,2 km')
  })

  it('formats whole kilometers without decimals', () => {
    expect(formatDistance(5)).toBe('5 km')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- geo.test.ts`
Expected: FAIL — `Cannot find module '@/lib/geo'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/geo.ts`:
```ts
const EARTH_RADIUS_KM = 6371

type Coordinates = { lat: number; lng: number }

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  const rounded = Math.round(km * 10) / 10
  return Number.isInteger(rounded)
    ? `${rounded} km`
    : `${rounded.toFixed(1).replace('.', ',')} km`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- geo.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/geo.ts src/lib/__tests__/geo.test.ts
git commit -m "Add Haversine distance and formatting utilities"
```

---

### Task 6: Seed script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config)

**Interfaces:**
- Consumes: `prisma` from `src/lib/db.ts`, `hashPassword` from `src/lib/password.ts`
- Produces: seeded rows in `City`, `Category`, `Plan`, `User` (one ADMIN, one MERCHANT per demo business, one CONSUMER), `Business`, `Offer` — later plans' manual QA and the end-to-end flow verification (Task 9 of the design doc's build order) rely on this data existing.

- [ ] **Step 1: Write `prisma/seed.ts`**

```ts
import { prisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/password'

async function main() {
  const [pr] = await Promise.all([
    prisma.city.upsert({ where: { name_state: { name: 'Marmeleiro', state: 'PR' } }, update: {}, create: { name: 'Marmeleiro', state: 'PR', active: true } }),
  ])
  await prisma.city.upsert({ where: { name_state: { name: 'Francisco Beltrão', state: 'PR' } }, update: {}, create: { name: 'Francisco Beltrão', state: 'PR', active: true } })
  await prisma.city.upsert({ where: { name_state: { name: 'Pato Branco', state: 'PR' } }, update: {}, create: { name: 'Pato Branco', state: 'PR', active: true } })
  await prisma.city.upsert({ where: { name_state: { name: 'Curitiba', state: 'PR' } }, update: {}, create: { name: 'Curitiba', state: 'PR', active: false, comingSoon: true } })

  const categoryData = [
    { name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1 },
    { name: 'Bares e Cafeterias', icon: 'coffee', order: 2 },
    { name: 'Beleza e Estética', icon: 'scissors', order: 3 },
    { name: 'Saúde e Bem-estar', icon: 'heart', order: 4 },
    { name: 'Lojas e Moda', icon: 'shopping-bag', order: 5 },
    { name: 'Serviços e Manutenção', icon: 'wrench', order: 6 },
    { name: 'Automotivo', icon: 'car', order: 7 },
    { name: 'Casa e Construção', icon: 'home', order: 8 },
  ]
  const categories: Record<string, string> = {}
  for (const c of categoryData) {
    const created = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    })
    categories[c.name] = created.id
  }

  const planData = [
    { name: 'Grátis', priceCents: 0, maxOffersPerMonth: 3, hasFlashOffers: false, hasFullMetrics: false },
    { name: 'Pro', priceCents: 4990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
    { name: 'Destaque', priceCents: 9990, maxOffersPerMonth: 999, hasFlashOffers: true, hasFullMetrics: true },
  ]
  const plans: Record<string, string> = {}
  for (const p of planData) {
    const created = await prisma.plan.upsert({ where: { name: p.name }, update: {}, create: p })
    plans[p.name] = created.id
  }

  const adminPasswordHash = await hashPassword('admin123')
  await prisma.user.upsert({
    where: { email: 'admin@akiofertas.com.br' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@akiofertas.com.br',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  })

  const merchantPasswordHash = await hashPassword('comerciante123')
  const owner = await prisma.user.upsert({
    where: { email: 'joao@bigburger.com.br' },
    update: {},
    create: {
      name: 'João Silva',
      email: 'joao@bigburger.com.br',
      passwordHash: merchantPasswordHash,
      role: 'MERCHANT',
    },
  })

  const business = await prisma.business.upsert({
    where: { slug: 'big-burger' },
    update: {},
    create: {
      ownerId: owner.id,
      name: 'Big Burger',
      categoryId: categories['Restaurantes e Lanchonetes'],
      whatsapp: '5546999990000',
      address: 'Av. Brasil, 100',
      city: 'Marmeleiro',
      state: 'PR',
      lat: -25.9006,
      lng: -53.0489,
      description: 'Hambúrgueres artesanais no centro de Marmeleiro.',
      status: 'ACTIVE',
      planId: plans['Pro'],
      slug: 'big-burger',
    },
  })

  await prisma.offer.upsert({
    where: { slug: 'combo-burguer-big-burger' },
    update: {},
    create: {
      businessId: business.id,
      title: 'Combo Burguer',
      description: 'Pão artesanal, hambúrguer 150g, queijo, batata rústica e refri 350ml.',
      originalPrice: 4290,
      discountPrice: 2990,
      discountPercent: 30,
      categoryId: categories['Restaurantes e Lanchonetes'],
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      slug: 'combo-burguer-big-burger',
    },
  })

  const consumerPasswordHash = await hashPassword('consumidor123')
  await prisma.user.upsert({
    where: { email: 'rafael@example.com' },
    update: {},
    create: {
      name: 'Rafael',
      email: 'rafael@example.com',
      passwordHash: consumerPasswordHash,
      role: 'CONSUMER',
      city: 'Marmeleiro',
      state: 'PR',
    },
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 2: Wire the seed command**

Add to `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Run: `npm install -D tsx`

- [ ] **Step 3: Run the seed**

Run: `npx prisma db seed`
Expected: console prints `Seed complete.` with no errors.

- [ ] **Step 4: Verify seeded data**

Run: `npx prisma studio` briefly (or query via `npx prisma db execute --stdin <<< "select count(*) from businesses;"`) and confirm 1 business, 1 offer, 3 users, 4 cities, 8 categories, 3 plans exist. Close Prisma Studio.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma/schema.prisma package.json
git commit -m "Add seed script with demo cities, categories, plans and Big Burger"
```

---

### Task 7: Auth.js configuration

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/db.ts`, `verifyPassword` from `src/lib/password.ts`
- Produces: `auth()`, `signIn`, `signOut` exported from `src/lib/auth.ts` — used by Task 8's middleware and by every later login/logout UI. Session's `user` object carries `id`, `email`, `name`, and `role` (one of `CONSUMER` | `MERCHANT` | `ADMIN`).

- [ ] **Step 1: Write `src/lib/auth.ts`**

```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/entrar' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = (user as { role: string }).role
      }
      return token
    },
    session: ({ session, token }) => {
      if (session.user) {
        ;(session.user as { role?: string }).role = token.role as string
      }
      return session
    },
  },
})
```

- [ ] **Step 2: Wire the route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
export { GET, POST } from '@/lib/auth'
```

- [ ] **Step 3: Set `AUTH_SECRET`**

Run: `npx auth secret` and copy the generated value into `.env` as `AUTH_SECRET`.

- [ ] **Step 4: Verify the app still builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

Run: `npm run dev` in the background, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/providers` (expect `200`), then stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth
git commit -m "Add Auth.js credentials provider with role in session"
```

---

### Task 8: Consumer signup server action (TDD)

**Files:**
- Create: `src/actions/auth-actions.ts`
- Test: `src/actions/__tests__/auth-actions.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/db.ts`, `hashPassword` from `src/lib/password.ts`
- Produces: `signUpConsumer(input: { name: string; email: string; phone?: string; password: string; city?: string; state?: string }): Promise<{ ok: true; userId: string } | { ok: false; error: string }>` — used by the consumer signup page in the consumer-app plan.

- [ ] **Step 1: Write the failing test**

Create `src/actions/__tests__/auth-actions.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signUpConsumer } from '@/actions/auth-actions'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('signUpConsumer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid email', async () => {
    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'not-an-email',
      password: 'senha1234',
    })
    expect(result).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects a password shorter than 8 characters', async () => {
    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'rafael@example.com',
      password: '1234567',
    })
    expect(result).toEqual({ ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.' })
  })

  it('rejects a duplicate email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'rafael@example.com',
      password: 'senha1234',
    })
    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
  })

  it('creates the user with a hashed password on success', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-user-id' } as never)

    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'rafael@example.com',
      password: 'senha1234',
      city: 'Marmeleiro',
      state: 'PR',
    })

    expect(result).toEqual({ ok: true, userId: 'new-user-id' })
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    expect(createCall.data.email).toBe('rafael@example.com')
    expect(createCall.data.passwordHash).not.toBe('senha1234')
    expect(createCall.data.role).toBe('CONSUMER')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- auth-actions.test.ts`
Expected: FAIL — `Cannot find module '@/actions/auth-actions'`

- [ ] **Step 3: Write the implementation**

Create `src/actions/auth-actions.ts`:
```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

const signUpSchema = z.object({
  name: z.string().min(2, 'Informe seu nome.'),
  email: z.string().email('E-mail inválido.'),
  phone: z.string().optional(),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  city: z.string().optional(),
  state: z.string().optional(),
})

type SignUpInput = z.infer<typeof signUpSchema>
type SignUpResult = { ok: true; userId: string } | { ok: false; error: string }

export async function signUpConsumer(input: SignUpInput): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  const passwordHash = await hashPassword(parsed.data.password)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash,
      role: 'CONSUMER',
      city: parsed.data.city,
      state: parsed.data.state,
    },
  })

  return { ok: true, userId: user.id }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- auth-actions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/actions/auth-actions.ts src/actions/__tests__/auth-actions.test.ts
git commit -m "Add consumer signup server action with validation"
```

---

### Task 9: Role-based middleware

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `auth` from `src/lib/auth.ts`
- Produces: route protection — unauthenticated users hitting `/comerciante/**` or `/admin/**` are redirected to `/entrar`; authenticated users whose `role` doesn't match the area are redirected to `/` with a `?erro=acesso-negado` query param. Later plans' pages assume this guard already ran and don't need their own auth checks for page-level access (Server Actions still re-check per Global Constraints).

- [ ] **Step 1: Write `src/middleware.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const role = (req.auth?.user as { role?: string } | undefined)?.role

  const isMerchantArea = pathname.startsWith('/comerciante')
  const isAdminArea = pathname.startsWith('/admin')

  if ((isMerchantArea || isAdminArea) && !req.auth) {
    const signInUrl = new URL('/entrar', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (isMerchantArea && role !== 'MERCHANT') {
    return NextResponse.redirect(new URL('/?erro=acesso-negado', req.nextUrl.origin))
  }

  if (isAdminArea && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/?erro=acesso-negado', req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/comerciante/:path*', '/admin/:path*'],
}
```

- [ ] **Step 2: Verify unauthenticated redirect**

Run: `npm run dev` in the background.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/comerciante` — expect a `307` redirect status (or follow with `curl -sL -o /dev/null -w "%{url_effective}"` and confirm it lands on `/entrar?callbackUrl=%2Fcomerciante`).
Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "Add role-based route protection middleware"
```

---

### Task 10: Area layouts and shared login page

**Files:**
- Create: `src/components/layout/ConsumerShell.tsx`, `src/components/layout/DashboardShell.tsx`
- Create: `src/app/(consumer)/layout.tsx`, `src/app/(consumer)/page.tsx`
- Create: `src/app/comerciante/layout.tsx`, `src/app/comerciante/page.tsx`
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- Create: `src/app/entrar/page.tsx`

**Interfaces:**
- Consumes: `ConsumerShell` and `DashboardShell` components; `signIn` from `src/lib/auth.ts`.
- Produces: `<ConsumerShell>{children}</ConsumerShell>` (bottom-nav mobile shell, props: `children: ReactNode`) and `<DashboardShell area="comerciante" | "admin">{children}</DashboardShell>` (sidebar shell, props: `area: 'comerciante' | 'admin'`, `children: ReactNode`) — every page added by the consumer-app, comerciante, and admin plans renders inside one of these.

- [ ] **Step 1: Write the consumer shell**

Create `src/components/layout/ConsumerShell.tsx`:
```tsx
import Link from 'next/link'

export function ConsumerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="flex-1 pb-16">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-neutral-200 bg-white py-2 text-xs text-neutral-500">
        <Link href="/" className="flex flex-col items-center gap-1 px-3 py-1">
          Início
        </Link>
        <Link href="/cupons" className="flex flex-col items-center gap-1 px-3 py-1">
          Cupons
        </Link>
        <Link href="/favoritos" className="flex flex-col items-center gap-1 px-3 py-1">
          Favoritos
        </Link>
        <Link href="/perfil" className="flex flex-col items-center gap-1 px-3 py-1">
          Perfil
        </Link>
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Write the dashboard shell**

Create `src/components/layout/DashboardShell.tsx`:
```tsx
import Link from 'next/link'

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
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="w-56 flex-shrink-0 bg-[#0B1B33] p-4 text-white">
        <p className="mb-6 px-2 text-lg font-bold">
          Aki<span className="text-emerald-400">Ofertas</span>
        </p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS[area].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Wire the consumer area**

Create `src/app/(consumer)/layout.tsx`:
```tsx
import { ConsumerShell } from '@/components/layout/ConsumerShell'

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>
}
```

Create `src/app/(consumer)/page.tsx`:
```tsx
export default function HomePage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Aki Ofertas</h1>
      <p className="text-sm text-neutral-500">Home do consumidor — em construção.</p>
    </div>
  )
}
```

- [ ] **Step 4: Wire the comerciante area**

Create `src/app/comerciante/layout.tsx`:
```tsx
import { DashboardShell } from '@/components/layout/DashboardShell'

export default function ComercianteLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell area="comerciante">{children}</DashboardShell>
}
```

Create `src/app/comerciante/page.tsx`:
```tsx
export default function ComercianteDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-bold">Painel do comerciante</h1>
      <p className="text-sm text-neutral-500">Dashboard — em construção.</p>
    </div>
  )
}
```

- [ ] **Step 5: Wire the admin area**

Create `src/app/admin/layout.tsx`:
```tsx
import { DashboardShell } from '@/components/layout/DashboardShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell area="admin">{children}</DashboardShell>
}
```

Create `src/app/admin/page.tsx`:
```tsx
export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-bold">Painel administrativo</h1>
      <p className="text-sm text-neutral-500">Dashboard — em construção.</p>
    </div>
  )
}
```

- [ ] **Step 6: Write the shared login page**

Create `src/app/entrar/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function EntrarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    if (result?.error) {
      setError('E-mail ou senha incorretos.')
      return
    }
    router.push(searchParams.get('callbackUrl') ?? '/')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-xl font-bold">Entrar</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
        >
          Entrar
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Verify the three areas render**

Run: `npm run dev` in the background.
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` (expect `200`)
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/entrar` (expect `200`)
Stop the dev server.

- [ ] **Step 8: Run the full test suite**

Run: `npm run test`
Expected: all tests from Tasks 3, 4, 5, and 8 pass (13 tests total).

- [ ] **Step 9: Commit**

```bash
git add src/components/layout src/app
git commit -m "Add consumer, comerciante and admin shells with shared login page"
```

---

## What this plan does not cover

Home feed content, offer/store pages, coupon generation UI, comerciante offer CRUD, comerciante coupon validation UI, and every admin management screen are built in follow-up plans (`consumer-app`, `comerciante-panel`, `admin-panel`, `coupons-and-plans`) that build on top of this foundation, per the design doc's suggested implementation order (steps 3–9).
