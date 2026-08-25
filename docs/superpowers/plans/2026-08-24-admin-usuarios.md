# Admin Usuários Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin search all users, block/unblock accounts, and edit a user's profile fields — the `/admin/usuarios` nav link (present since the Foundation plan, 404ing ever since) becomes a real page.

**Architecture:** Same layering as every prior plan — thin Server Component pages over small, testable `src/lib/` query functions and `src/actions/*.ts` Server Actions, reusing the existing `requireAdmin()` helper. A blocked user must be rejected at login, so this plan also touches `src/lib/auth.ts`'s credentials `authorize` callback — the one place in the codebase that isn't itself covered by a unit test (NextAuth's `Credentials` provider isn't practically unit-testable in isolation), so that one change is verified via a real login attempt instead of a Vitest test, matching how login was already verified end-to-end in the Foundation plan's own middleware task.

**Tech Stack:** Next.js 14 App Router (Server Components + Server Actions), Prisma (Neon), Auth.js, Zod v4, Vitest.

## Global Constraints

- Every Server Action re-checks the session role server-side — never trust middleware alone (from the Foundation plan).
- Brand name throughout code and copy is "Aki Ofertas".
- Reuse existing code: `prisma` (`@/lib/db`), `requireAdmin()` (`src/actions/admin-actions.ts`, private helper already used by every admin action), `DashboardShell` (already has the `/admin/usuarios` nav link, from the Foundation plan — no nav change needed).
- User-facing query results must never include `passwordHash` — every read in this plan uses an explicit Prisma `select` that omits it, never a bare `findMany`/`findUnique` that would return the full row.
- An admin must not be able to block their own account (the only way back in would be direct database access) — `toggleUserBlocked` rejects that specific case.
- Every new `/admin/**` page in this plan inherits `force-dynamic` from `src/app/admin/layout.tsx` (added by the Admin-Panel plan's final review fix) — no per-page dynamic export is needed here, but don't remove or shadow that layout-level setting.

---

## File structure this plan produces

```
prisma/
  schema.prisma                 # modified: User gets a `blocked` field
  migrations/
    <timestamp>_add_user_blocked/
      migration.sql
src/
  lib/
    auth.ts                     # modified: authorize() rejects blocked users
    admin.ts                    # modified: getUsersForAdmin, getUserById added
    __tests__/
      admin.test.ts             # modified: their tests added
  actions/
    admin-actions.ts            # modified: toggleUserBlocked, updateUser added
    __tests__/
      admin-actions.test.ts     # modified: their tests added
  components/
    admin/
      UserBlockToggle.tsx
      UserForm.tsx
  app/
    admin/
      usuarios/
        page.tsx
        [id]/
          page.tsx
```

---

### Task 1: Add `blocked` to the User model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing.
- Produces: `User.blocked: Boolean` (default `false`) — used by Task 2 (login rejection), Task 3 (read queries), Task 4 (toggle action), Task 5 (list page).

- [ ] **Step 1: Add the field**

In `prisma/schema.prisma`, find the `User` model:
```prisma
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
```

Add `blocked` right after `role`:
```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  phone        String?
  passwordHash String
  role         Role     @default(CONSUMER)
  blocked      Boolean  @default(false)
  city         String?
  state        String?
  createdAt    DateTime @default(now())
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_user_blocked`
Expected: migration succeeds, creates `prisma/migrations/<timestamp>_add_user_blocked/migration.sql` adding the `blocked` column (defaulting existing rows to `false`), and regenerates the Prisma client.

- [ ] **Step 3: Verify the client compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add blocked field to User model"
```

---

### Task 2: Reject blocked users at login

**Files:**
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: `User.blocked` (Task 1), `prisma` from `@/lib/db`, `verifyPassword` from `@/lib/password`.
- Produces: no new exports — `authorize()`'s behavior changes: a blocked user's credentials, even if correct, no longer produce a session. No later task in this plan imports anything from this change; Task 4's `toggleUserBlocked` is what an admin uses to set the flag this task now enforces.

- [ ] **Step 1: Add the block check**

In `src/lib/auth.ts`, find:
```ts
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
```

Replace it with:
```ts
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) return null

        if (user.blocked) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
```

- [ ] **Step 2: Verify a normal (non-blocked) login still works**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background.
Log in as the seeded consumer via the curl+cookie-jar technique already used throughout this project:
```bash
curl -s -c cookies.txt http://localhost:3000/api/auth/csrf
```
Extract the `csrfToken` from the JSON response, then:
```bash
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -d "email=rafael@example.com&password=consumidor123&csrfToken=<token>&callbackUrl=%2F&json=true"
```
Confirm the response is a redirect (not an error) and `curl -s -b cookies.txt http://localhost:3000/api/auth/session` shows a session with `"email":"rafael@example.com"`.

- [ ] **Step 3: Verify a blocked user cannot log in**

With the dev server still running, block the seeded consumer directly at the database level (no admin UI exists yet — that's Task 5):
```bash
echo "UPDATE users SET blocked = true WHERE email = 'rafael@example.com';" | npx prisma db execute --stdin --schema prisma/schema.prisma
```
Repeat the same login attempt as Step 2 (fresh cookie jar, fresh CSRF token). Confirm the response now indicates failure (the JSON response's `url` will contain `error=CredentialsSignin`, or `/api/auth/session` after the attempt shows no session).

Then immediately restore the account so later manual verification in this plan (and any other testing) isn't left broken:
```bash
echo "UPDATE users SET blocked = false WHERE email = 'rafael@example.com';" | npx prisma db execute --stdin --schema prisma/schema.prisma
```
Confirm a login with the same credentials succeeds again (repeat Step 2's check once more).

Delete any cookie jar files created during this step. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "Reject login for blocked users"
```

---

### Task 3: Admin user read queries

**Files:**
- Modify: `src/lib/admin.ts` (add `getUsersForAdmin`, `getUserById`)
- Modify: `src/lib/__tests__/admin.test.ts` (add their tests)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `type AdminUserRow = { id: string; name: string; email: string; phone: string | null; role: 'CONSUMER' | 'MERCHANT' | 'ADMIN'; city: string | null; state: string | null; blocked: boolean; createdAt: Date }`, `getUsersForAdmin(query?: string): Promise<AdminUserRow[]>` (searches name/email case-insensitively when `query` is given, all users otherwise, newest first), `getUserById(id: string): Promise<AdminUserRow | null>` — used by Task 5 (list page) and Task 6 (edit page). Neither function ever selects `passwordHash`.

- [ ] **Step 1: Write the failing test**

In `src/lib/__tests__/admin.test.ts`, add the import at the top alongside the existing one:
```ts
import { getPlatformStats, getBusinessesForAdmin, getAllCategories, getCategoryById, getAllCities, getCityById, getUsersForAdmin, getUserById } from '@/lib/admin'
```
(add `user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() }` to the existing `vi.mock('@/lib/db', ...)` factory's `prisma` object — merge it into the existing `user` key, which currently only has `count`, so the merged entry becomes `user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() }`)

Append these two `describe` blocks at the end of the file:
```ts
const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  city: true,
  state: true,
  blocked: true,
  createdAt: true,
}

describe('getUsersForAdmin', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries every user, newest first, when no query is given', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 'user-1' }] as never)

    const result = await getUsersForAdmin()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {},
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'user-1' }])
  })

  it('searches by name or email, case-insensitively, when a query is given', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)

    await getUsersForAdmin('joao')

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: 'joao', mode: 'insensitive' } },
          { email: { contains: 'joao', mode: 'insensitive' } },
        ],
      },
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('getUserById', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('queries a single user by id, excluding passwordHash', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1' } as never)

    const result = await getUserById('user-1')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: userSelect })
    expect(result).toEqual({ id: 'user-1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- admin.test.ts`
Expected: FAIL — `getUsersForAdmin is not a function` (or similar export-not-found error)

- [ ] **Step 3: Write the implementation**

Append to `src/lib/admin.ts`:
```ts
const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  city: true,
  state: true,
  blocked: true,
  createdAt: true,
} as const

export async function getUsersForAdmin(query?: string) {
  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {},
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: userSelect })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- admin.test.ts`
Expected: PASS (10 tests — 7 from the Admin-Panel plan plus 3 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts src/lib/__tests__/admin.test.ts
git commit -m "Add admin user read queries"
```

---

### Task 4: Block-toggle and profile-update actions

**Files:**
- Modify: `src/actions/admin-actions.ts` (add `toggleUserBlocked`, `updateUser`)
- Modify: `src/actions/__tests__/admin-actions.test.ts` (add their tests)

**Interfaces:**
- Consumes: `requireAdmin` (existing private helper, same file), `prisma` from `@/lib/db`, `auth` from `@/lib/auth`.
- Produces: `toggleUserBlocked(userId: string, blocked: boolean): Promise<{ ok: true } | { ok: false; error: string }>`, `type UserProfileInput = { name: string; phone?: string; city?: string; state?: string }`, `updateUser(userId: string, input: UserProfileInput): Promise<{ ok: true } | { ok: false; error: string }>` — used by Task 5's `UserBlockToggle` and Task 6's `UserForm`.

- [ ] **Step 1: Write the failing test**

In `src/actions/__tests__/admin-actions.test.ts`, add the import at the top alongside the existing one:
```ts
import { updateBusinessStatus, createCategory, updateCategory, createCity, updateCity, toggleUserBlocked, updateUser } from '@/actions/admin-actions'
```
(add `user: { findUnique: vi.fn(), update: vi.fn() }` to the existing `vi.mock('@/lib/db', ...)` factory's `prisma` object)

Append these two `describe` blocks at the end of the file:
```ts
describe('toggleUserBlocked', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'MERCHANT' } } as never)
    const result = await toggleUserBlocked('user-2', true)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the target user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)

    const result = await toggleUserBlocked('user-2', true)
    expect(result).toEqual({ ok: false, error: 'Usuário não encontrado.' })
  })

  it('rejects an admin trying to block their own account', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'admin-1' } as never)

    const result = await toggleUserBlocked('admin-1', true)
    expect(result).toEqual({ ok: false, error: 'Você não pode bloquear sua própria conta.' })
  })

  it('blocks a different user successfully', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-2' } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-2' } as never)

    const result = await toggleUserBlocked('user-2', true)

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-2' }, data: { blocked: true } })
  })

  it('allows unblocking, including targeting the admin\'s own account', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'admin-1' } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'admin-1' } as never)

    const result = await toggleUserBlocked('admin-1', false)

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'admin-1' }, data: { blocked: false } })
  })
})

const validUserInput = { name: 'Rafael Souza', phone: '5546999997777', city: 'Marmeleiro', state: 'PR' }

describe('updateUser', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when the session role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'CONSUMER' } } as never)
    const result = await updateUser('user-2', validUserInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid name', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    const result = await updateUser('user-2', { ...validUserInput, name: 'R' })
    expect(result).toEqual({ ok: false, error: 'Informe o nome.' })
  })

  it('rejects when the user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)

    const result = await updateUser('user-2', validUserInput)
    expect(result).toEqual({ ok: false, error: 'Usuário não encontrado.' })
  })

  it('updates the user when it exists', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-2' } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-2' } as never)

    const result = await updateUser('user-2', validUserInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { name: 'Rafael Souza', phone: '5546999997777', city: 'Marmeleiro', state: 'PR' },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- admin-actions.test.ts`
Expected: FAIL — `toggleUserBlocked is not a function` (or similar export-not-found error)

- [ ] **Step 3: Write the implementation**

Append to `src/actions/admin-actions.ts`:
```ts
export async function toggleUserBlocked(
  userId: string,
  blocked: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    return { ok: false, error: 'Não autorizado.' }
  }

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) {
    return { ok: false, error: 'Usuário não encontrado.' }
  }

  if (blocked && target.id === (session.user as { id: string }).id) {
    return { ok: false, error: 'Você não pode bloquear sua própria conta.' }
  }

  await prisma.user.update({ where: { id: userId }, data: { blocked } })

  return { ok: true }
}

const userProfileSchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})

type UserProfileInput = z.infer<typeof userProfileSchema>

export async function updateUser(
  userId: string,
  input: UserProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = userProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) {
    return { ok: false, error: 'Usuário não encontrado.' }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
    },
  })

  return { ok: true }
}
```

Note: `toggleUserBlocked` calls `auth()` directly (needing `session.user.id` for the self-block check) rather than the boolean-only `requireAdmin()` helper, while `updateUser` uses `requireAdmin()` like every other action in this file — this is intentional, not an inconsistency to fix, since only the self-block check needs the acting admin's own id.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- admin-actions.test.ts`
Expected: PASS (28 tests — 19 from the Admin-Panel plan plus 9 new)

- [ ] **Step 5: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts
git commit -m "Add user block-toggle and profile-update actions"
```

---

### Task 5: Usuarios list page with search and block toggle

**Files:**
- Create: `src/components/admin/UserBlockToggle.tsx`, `src/app/admin/usuarios/page.tsx`

**Interfaces:**
- Consumes: `getUsersForAdmin` from `@/lib/admin`, `toggleUserBlocked` from `@/actions/admin-actions`.
- Produces: `/admin/usuarios` route with `?q=` search. No later task consumes new exports here.

- [ ] **Step 1: Write the block-toggle button**

Create `src/components/admin/UserBlockToggle.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleUserBlocked } from '@/actions/admin-actions'

export function UserBlockToggle({ userId, blocked }: { userId: string; blocked: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const result = await toggleUserBlocked(userId, !blocked)
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
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
          blocked ? 'bg-brand-green text-white' : 'border border-neutral-200 text-red-600'
        }`}
      >
        {pending ? 'Aguarde...' : blocked ? 'Desbloquear' : 'Bloquear'}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Wire the usuarios list page**

Create `src/app/admin/usuarios/page.tsx`:
```tsx
import Link from 'next/link'
import { getUsersForAdmin } from '@/lib/admin'
import { UserBlockToggle } from '@/components/admin/UserBlockToggle'

const ROLE_LABEL: Record<string, string> = {
  CONSUMER: 'Consumidor',
  MERCHANT: 'Comerciante',
  ADMIN: 'Administrador',
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const users = await getUsersForAdmin(searchParams.q)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Usuários</h1>

      <form method="GET" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar por nome ou e-mail"
          className="w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white">
          Buscar
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum usuário encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-bold text-neutral-900">{user.name}</p>
                <p className="text-xs text-neutral-500">{user.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                    {ROLE_LABEL[user.role]}
                  </span>
                  {user.blocked && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      Bloqueado
                    </span>
                  )}
                  <Link href={`/admin/usuarios/${user.id}`} className="text-xs font-bold text-brand-green">
                    Editar
                  </Link>
                </div>
              </div>
              <UserBlockToggle userId={user.id} blocked={user.blocked} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify with the seeded users**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Log in as the seeded admin (curl+cookie-jar technique: CSRF token + POST to `/api/auth/callback/credentials` with `admin@akiofertas.com.br` / `admin123`). `curl -s -b cookies.txt http://localhost:3000/admin/usuarios` and confirm the response contains "Rafael" (the seeded consumer) and "João Silva" (the seeded merchant). `curl -s -b cookies.txt "http://localhost:3000/admin/usuarios?q=joao"` and confirm the response contains "João Silva" but not "Rafael". Delete the cookie jar when done.
Stop the dev server.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/UserBlockToggle.tsx "src/app/admin/usuarios/page.tsx"
git commit -m "Add usuarios list page with search and block toggle"
```

---

### Task 6: Usuario edit page

**Files:**
- Create: `src/components/admin/UserForm.tsx`, `src/app/admin/usuarios/[id]/page.tsx`

**Interfaces:**
- Consumes: `getUserById` from `@/lib/admin`, `updateUser` from `@/actions/admin-actions`.
- Produces: `/admin/usuarios/[id]` route. Terminal task for this plan.

- [ ] **Step 1: Write the shared user form**

Create `src/components/admin/UserForm.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateUser } from '@/actions/admin-actions'

type Values = {
  name: string
  phone: string
  city: string
  state: string
}

export function UserForm({ userId, initialValues }: { userId: string; initialValues: Values }) {
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
    try {
      const result = await updateUser(userId, values)
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

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nome
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Telefone
        <input value={values.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Cidade
          <input value={values.city} onChange={(e) => update('city', e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          UF
          <input maxLength={2} value={values.state} onChange={(e) => update('state', e.target.value)} className={inputClass} />
        </label>
      </div>

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

- [ ] **Step 2: Wire the edit page**

Create `src/app/admin/usuarios/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/admin'
import { UserForm } from '@/components/admin/UserForm'

export default async function EditarUsuarioPage({ params }: { params: { id: string } }) {
  const user = await getUserById(params.id)
  if (!user) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Editar usuário</h1>
        <p className="text-sm text-neutral-500">{user.email}</p>
      </div>
      <UserForm
        userId={user.id}
        initialValues={{
          name: user.name,
          phone: user.phone ?? '',
          city: user.city ?? '',
          state: user.state ?? '',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify the full plan end-to-end**

Run: `npm run build`
Expected: exit 0.

Run: `npm run dev` in the background. Log in as the seeded admin (curl+cookie-jar). Find the seeded consumer's id via `curl -s -b cookies.txt "http://localhost:3000/admin/usuarios?q=rafael" | grep -o '/admin/usuarios/[a-z0-9]*'`. `curl -s -b cookies.txt http://localhost:3000/admin/usuarios/<that-id>` and confirm the form is prefilled with "Rafael" and "Marmeleiro". Delete the cookie jar when done.
Stop the dev server.

- [ ] **Step 4: Run the full test suite and final verification**

Run: `npm run test` — record the final total test count.
Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run build` — expect exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/UserForm.tsx "src/app/admin/usuarios/[id]"
git commit -m "Add usuario edit page"
```

---

## What this plan does not cover

Role changes (promoting/demoting a user between CONSUMER/MERCHANT/ADMIN) are deliberately excluded — a role change on a MERCHANT with an existing business, or on the last remaining ADMIN, has correctness implications (ownership assumptions, lockout risk) this plan doesn't address, so it's left for a future plan if the need arises. Editing a user's email or password from the admin side is also out of scope (email is the login identifier and password changes need their own reset-flow design, not a plain form field) — an admin who needs to help a locked-out user today still has direct database access as a fallback, same as before this plan. Deleting a user account entirely is not built — blocking is the only removal mechanism, consistent with the spec's "bloquear/desbloquear" wording (spec section 25) rather than hard deletion.
