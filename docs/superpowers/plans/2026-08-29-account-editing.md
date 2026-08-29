# Edição de Cadastro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comerciante edita nome/e-mail/senha da própria conta; cliente do app edita nome/telefone do próprio perfil; admin passa a poder editar o e-mail de qualquer usuário.

**Architecture:** Duas novas server actions (`src/actions/account-actions.ts`) e uma nova aba "Conta" no painel do comerciante. Uma rota `PUT` nova no endpoint mobile já existente `/api/mobile/perfil`, mais um modo de edição na tela de perfil do app. Um campo a mais (`email`) no formulário/action de edição de usuário já existentes no admin. Nenhuma mudança de schema — todos os campos (`name`, `email`, `passwordHash`, `phone`) já existem em `User`.

**Tech Stack:** Next.js 14 (App Router, Server Actions), Prisma/Postgres, bcryptjs, Vitest; Expo Router / React Native, Jest, TanStack Query.

## Global Constraints

- Trocar e-mail (comerciante ou admin editando qualquer usuário) checa duplicidade via `prisma.user.findFirst({ where: { email, NOT: { id: userId } } })`; em conflito, erro **exatamente** `'Este e-mail já está cadastrado.'` (mesma mensagem já usada em `signUpMerchant`, `src/actions/merchant-actions.ts:34`).
- Senha nova (comerciante trocando a própria senha): mesma regra de `signUpMerchant` — `z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.')`.
- Cliente do app: e-mail **não** é editável (é a identidade de login) — só nome e telefone.
- Autorização do comerciante em `account-actions.ts` usa `requireMerchantBusiness()` (já existe em `src/actions/offer-actions.ts`), mesmo padrão do resto do painel — o `userId` alvo é `business.ownerId`.
- Autorização das rotas mobile usa `requireMobileUser(request)` (já existe em `src/lib/mobile-session.ts`).
- `POST /api/mobile/perfil/telefone` (rota já existente, usada pelo fluxo de gerar cupom) **não muda**.

---

### Task 1: Server actions da conta do comerciante

**Files:**
- Create: `src/actions/account-actions.ts`
- Create: `src/actions/__tests__/account-actions.test.ts`

**Interfaces:**
- Consumes: `requireMerchantBusiness()` de `src/actions/offer-actions.ts` (retorna `{ id, ownerId, ... } | null`); `hashPassword`, `verifyPassword` de `src/lib/password.ts`.
- Produces: `updateMerchantAccount(input: { name: string; email: string }): Promise<{ ok: true } | { ok: false; error: string }>`
- Produces: `changeMerchantPassword(input: { currentPassword: string; newPassword: string }): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Criar `src/actions/account-actions.ts`**

```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { hashPassword, verifyPassword } from '@/lib/password'

type AccountResult = { ok: true } | { ok: false; error: string }

const accountSchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  email: z.string().email('E-mail inválido.'),
})

type AccountInput = z.infer<typeof accountSchema>

export async function updateMerchantAccount(input: AccountInput): Promise<AccountResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = accountSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const conflict = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: business.ownerId } },
  })
  if (conflict) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  await prisma.user.update({
    where: { id: business.ownerId },
    data: { name: parsed.data.name, email: parsed.data.email },
  })

  return { ok: true }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
})

type PasswordInput = z.infer<typeof passwordSchema>

export async function changeMerchantPassword(input: PasswordInput): Promise<AccountResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = passwordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const user = await prisma.user.findUnique({ where: { id: business.ownerId } })
  if (!user?.passwordHash) {
    return { ok: false, error: 'Conta não encontrada.' }
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!valid) {
    return { ok: false, error: 'Senha atual incorreta.' }
  }

  const newHash = await hashPassword(parsed.data.newPassword)
  await prisma.user.update({ where: { id: business.ownerId }, data: { passwordHash: newHash } })

  return { ok: true }
}
```

- [ ] **Step 2: Testes em `src/actions/__tests__/account-actions.test.ts`**

Seguir o estilo de `src/actions/__tests__/delivery-zone-actions.test.ts` (mock de `@/actions/offer-actions` e `@/lib/db`; aqui também mockar `@/lib/password`):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateMerchantAccount, changeMerchantPassword } from '@/actions/account-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('new-hash'),
  verifyPassword: vi.fn(),
}))

const business = { id: 'biz-1', ownerId: 'user-1' }

describe('updateMerchantAccount', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await updateMerchantAccount({ name: 'Rafael', email: 'rafael@example.com' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid email', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    const result = await updateMerchantAccount({ name: 'Rafael', email: 'not-an-email' })
    expect(result).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects an email already used by another account', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'other-user' } as never)

    const result = await updateMerchantAccount({ name: 'Rafael', email: 'taken@example.com' })

    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'taken@example.com', NOT: { id: 'user-1' } },
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the name and email when there is no conflict', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const result = await updateMerchantAccount({ name: 'Rafael Souza', email: 'rafael@example.com' })

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Rafael Souza', email: 'rafael@example.com' },
    })
  })
})

describe('changeMerchantPassword', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await changeMerchantPassword({ currentPassword: 'old12345', newPassword: 'new12345' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects a new password shorter than 8 characters', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    const result = await changeMerchantPassword({ currentPassword: 'old12345', newPassword: 'short' })
    expect(result).toEqual({ ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.' })
  })

  it('rejects when the current password is wrong', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: 'stored-hash' } as never)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const result = await changeMerchantPassword({ currentPassword: 'wrong', newPassword: 'new12345' })

    expect(result).toEqual({ ok: false, error: 'Senha atual incorreta.' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the password hash when the current password is correct', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: 'stored-hash' } as never)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    const result = await changeMerchantPassword({ currentPassword: 'old12345', newPassword: 'new12345' })

    expect(result).toEqual({ ok: true })
    expect(hashPassword).toHaveBeenCalledWith('new12345')
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: 'new-hash' } })
  })
})
```

- [ ] **Step 3: Rodar os testes**

```bash
npx vitest run src/actions/__tests__/account-actions.test.ts
```
Esperado: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/actions/account-actions.ts src/actions/__tests__/account-actions.test.ts
git commit -m "feat: server actions for merchant account and password editing"
```

---

### Task 2: Painel do comerciante — aba "Conta"

**Files:**
- Create: `src/components/merchant/AccountForm.tsx`
- Create: `src/components/merchant/PasswordForm.tsx`
- Create: `src/app/comerciante/conta/page.tsx`
- Modify: `src/components/layout/DashboardShell.tsx`

**Interfaces:**
- Consumes: `updateMerchantAccount`, `changeMerchantPassword` de `src/actions/account-actions.ts` (Task 1); `getBusinessForOwner` de `src/lib/merchant.ts`; `auth` de `src/lib/auth`.

- [ ] **Step 1: Criar `src/components/merchant/AccountForm.tsx`**

Mesmo padrão de formulário simples de `src/components/merchant/DeliveryZoneManager.tsx` (sem lista, só o formulário):

```tsx
'use client'

import { useState } from 'react'
import { updateMerchantAccount } from '@/actions/account-actions'

type Values = { name: string; email: string }

export function AccountForm({ initialValues }: { initialValues: Values }) {
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
      const result = await updateMerchantAccount(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(true)
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-bold text-neutral-900">Dados da conta</h2>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nome
        <input value={values.name} onChange={(e) => update('name', e.target.value)} className={inputClass} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        E-mail
        <input
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          className={inputClass}
          required
        />
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

- [ ] **Step 2: Criar `src/components/merchant/PasswordForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { changeMerchantPassword } from '@/actions/account-actions'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

export function PasswordForm() {
  const [values, setValues] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  function update(key: keyof typeof EMPTY, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (values.newPassword !== values.confirmPassword) {
      setError('A confirmação não bate com a nova senha.')
      return
    }

    setSaving(true)
    try {
      const result = await changeMerchantPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(true)
      setValues(EMPTY)
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-bold text-neutral-900">Trocar senha</h2>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Senha atual
        <input
          type="password"
          value={values.currentPassword}
          onChange={(e) => update('currentPassword', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Nova senha
        <input
          type="password"
          value={values.newPassword}
          onChange={(e) => update('newPassword', e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        Confirmar nova senha
        <input
          type="password"
          value={values.confirmPassword}
          onChange={(e) => update('confirmPassword', e.target.value)}
          className={inputClass}
          required
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">Senha alterada.</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-fit rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
      >
        {saving ? 'Salvando...' : 'Trocar senha'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Criar `src/app/comerciante/conta/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { AccountForm } from '@/components/merchant/AccountForm'
import { PasswordForm } from '@/components/merchant/PasswordForm'

export default async function ComercianteContaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Conta</h1>
      <AccountForm initialValues={{ name: session!.user!.name as string, email: session!.user!.email as string }} />
      <PasswordForm />
    </div>
  )
}
```

- [ ] **Step 4: Adicionar o item no menu lateral**

Em `src/components/layout/DashboardShell.tsx`, no array `comerciante`, adicionar a entrada como último item (depois de `{ href: '/comerciante/plano', label: 'Plano' }`):

```ts
    { href: '/comerciante/conta', label: 'Conta' },
```

- [ ] **Step 5: Verificar tipos e build**

```bash
npx tsc --noEmit
npm run build
```
Esperado: sem erros, rota `/comerciante/conta` aparece na saída do build.

- [ ] **Step 6: Commit**

```bash
git add src/components/merchant/AccountForm.tsx src/components/merchant/PasswordForm.tsx src/app/comerciante/conta/page.tsx src/components/layout/DashboardShell.tsx
git commit -m "feat: merchant account tab (name, email, password)"
```

---

### Task 3: Admin — liberar edição de e-mail

**Files:**
- Modify: `src/actions/admin-actions.ts`
- Modify: `src/actions/__tests__/admin-actions.test.ts`
- Modify: `src/components/admin/UserForm.tsx`
- Modify: `src/app/admin/usuarios/[id]/page.tsx`

**Interfaces:**
- Produces: `userProfileSchema` ganha `email: z.string().email('E-mail inválido.')`.
- Produces: `updateUser` passa a checar duplicidade de e-mail e gravar `email` no `data` do `prisma.user.update`.

- [ ] **Step 1: Atualizar `userProfileSchema`/`updateUser` em `src/actions/admin-actions.ts`**

Ler o arquivo primeiro para localizar o trecho exato (por volta da linha 216-254). Trocar:

```ts
const userProfileSchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})
```

por:

```ts
const userProfileSchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  email: z.string().email('E-mail inválido.'),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})
```

E dentro de `updateUser`, depois do `const existing = await prisma.user.findUnique(...)` e antes do `prisma.user.update`, adicionar a checagem de duplicidade:

```ts
  const conflict = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: userId } },
  })
  if (conflict) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }
```

E adicionar `email: parsed.data.email,` ao objeto `data` do `prisma.user.update` existente (junto de `name`, `phone`, `city`, `state`).

- [ ] **Step 2: Adicionar `findFirst` ao mock de `prisma.user` em `src/actions/__tests__/admin-actions.test.ts`**

No topo do arquivo (linha ~11), trocar:

```ts
    user: { findUnique: vi.fn(), update: vi.fn() },
```

por:

```ts
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
```

- [ ] **Step 3: Atualizar `validUserInput` e os testes de `updateUser`**

Trocar (linha ~392):

```ts
const validUserInput = { name: 'Rafael Souza', phone: '5546999997777', city: 'Marmeleiro', state: 'PR' }
```

por:

```ts
const validUserInput = { name: 'Rafael Souza', email: 'rafael@example.com', phone: '5546999997777', city: 'Marmeleiro', state: 'PR' }
```

No teste `'updates the user when it exists'` (linha ~428-443), adicionar `vi.mocked(prisma.user.findFirst).mockResolvedValue(null)` antes de chamar `updateUser`, e adicionar `email: 'rafael@example.com'` ao objeto `data` esperado em `expect(prisma.user.update).toHaveBeenCalledWith(...)`.

Adicionar um novo teste logo depois desse:

```ts
  it('rejects an email already used by another user', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
    mockUsersById({
      'admin-1': { id: 'admin-1', role: 'ADMIN', blocked: false },
      'user-2': { id: 'user-2' },
    })
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'other-user' } as never)

    const result = await updateUser('user-2', validUserInput)

    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
```

- [ ] **Step 4: Atualizar `src/components/admin/UserForm.tsx`**

Trocar o tipo `Values`:

```ts
type Values = {
  name: string
  email: string
  phone: string
  city: string
  state: string
}
```

Adicionar o campo de e-mail no JSX, logo depois do campo "Nome" e antes de "Telefone":

```tsx
      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
        E-mail
        <input
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          className={inputClass}
          required
        />
      </label>
```

- [ ] **Step 5: Atualizar `src/app/admin/usuarios/[id]/page.tsx`**

Adicionar `email: user.email,` ao objeto `initialValues` (junto de `name`, `phone`, `city`, `state`).

- [ ] **Step 6: Rodar os testes e verificar tipos**

```bash
npx vitest run src/actions/__tests__/admin-actions.test.ts
npx tsc --noEmit
```
Esperado: todos passando, sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/actions/admin-actions.ts src/actions/__tests__/admin-actions.test.ts src/components/admin/UserForm.tsx src/app/admin/usuarios/\[id\]/page.tsx
git commit -m "feat: allow admin to edit any user's email"
```

---

### Task 4: API mobile — `PUT /api/mobile/perfil` e hook

**Files:**
- Modify: `src/app/api/mobile/perfil/route.ts`
- Modify: `src/app/api/mobile/__tests__/data-endpoints.test.ts`
- Modify: `app-mobile/src/api/types.ts`
- Modify: `app-mobile/src/api/hooks/useProfile.ts`

**Interfaces:**
- Produces: `PUT /api/mobile/perfil` — body `{ name: string; phone: string }` → `{ ok: true } | { ok: false; error: string }`.
- Produces: `Profile` (mobile) ganha `phone: string | null`.
- Produces: `useUpdateProfile()` — `useMutation` que chama `PUT /perfil` e invalida a query `['perfil']`.

- [ ] **Step 1: Adicionar o handler `PUT` em `src/app/api/mobile/perfil/route.ts`**

Ler o arquivo primeiro (hoje só tem `GET`). Adicionar `z` ao import e o novo handler:

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'

export async function GET(request: Request) {
  // ... handler GET já existente, sem alteração
}

const putBodySchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  phone: z.string().min(8, 'Informe um telefone válido.'),
})

export async function PUT(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = putBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: { name: parsed.data.name, phone: parsed.data.phone },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Testes em `src/app/api/mobile/__tests__/data-endpoints.test.ts`**

Ler o arquivo primeiro — já importa `GET as getPerfil` de `@/app/api/mobile/perfil/route` (linha ~11) e já mocka `@/lib/db` com `user: { findUnique: vi.fn(), update: vi.fn() }` (linha ~27, já inclui `update`). Trocar o import para incluir `PUT`:

```ts
import { GET as getPerfil, PUT as putPerfil } from '@/app/api/mobile/perfil/route'
```

Adicionar, logo depois do `describe('GET /api/mobile/perfil', ...)` já existente (por volta da linha 157-181):

```ts
describe('PUT /api/mobile/perfil', () => {
  afterEach(() => vi.clearAllMocks())

  function request(body: unknown) {
    return new Request('https://example.com/api/mobile/perfil', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await putPerfil(request({ name: 'Maria', phone: '5546999990000' }))
    expect(response.status).toBe(401)
  })

  it('rejects an invalid name', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await putPerfil(request({ name: 'M', phone: '5546999990000' }))
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an invalid phone', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await putPerfil(request({ name: 'Maria', phone: '123' }))
    expect(response.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the name and phone for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })

    const response = await putPerfil(request({ name: 'Maria Silva', phone: '5546999990000' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Maria Silva', phone: '5546999990000' },
    })
  })
})
```

(`NextResponse` e `requireMobileUser` já estão importados no topo do arquivo — não duplicar o import.)

- [ ] **Step 3: Rodar os testes**

```bash
npx vitest run src/app/api/mobile/__tests__/data-endpoints.test.ts
```
Esperado: todos passando.

- [ ] **Step 4: Atualizar `app-mobile/src/api/types.ts`**

No tipo `Profile` (hoje `{ id: string; name: string; email: string; city: string | null }`), adicionar `phone: string | null`:

```ts
export type Profile = { id: string; name: string; email: string; city: string | null; phone: string | null }
```

- [ ] **Step 5: Adicionar `useUpdateProfile` em `app-mobile/src/api/hooks/useProfile.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import type { Profile } from '@/api/types'

export function useProfile() {
  const { token, authedFetch } = useAuth()
  return useQuery({
    queryKey: ['perfil'],
    queryFn: () => authedFetch<Profile>('/perfil'),
    enabled: token !== null,
  })
}

export function useUpdateProfile() {
  const { authedFetch } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { name: string; phone: string }) =>
      authedFetch<{ ok: true }>('/perfil', { method: 'PUT', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfil'] })
    },
  })
}
```

- [ ] **Step 6: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```
Esperado: sem erros novos (a tela `perfil.tsx` ainda não usa `useUpdateProfile` — isso é a Task 5).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/mobile/perfil/route.ts src/app/api/mobile/__tests__/data-endpoints.test.ts app-mobile/src/api/types.ts app-mobile/src/api/hooks/useProfile.ts
git commit -m "feat: PUT /api/mobile/perfil to update name and phone"
```

---

### Task 5: App mobile — editar nome e telefone na tela de perfil

**Files:**
- Modify: `app-mobile/app/(tabs)/perfil.tsx`

**Interfaces:**
- Consumes: `useProfile()`, `useUpdateProfile()` de `app-mobile/src/api/hooks/useProfile.ts` (Task 4); `Profile.phone` (Task 4).

- [ ] **Step 1: Reescrever `app-mobile/app/(tabs)/perfil.tsx`**

Substituir o arquivo inteiro por (mantém a tela de "Entre para ver seu perfil" e o loading exatamente como já estão; adiciona modo de edição para Nome/Telefone, E-mail continua só leitura):

```tsx
import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useProfile, useUpdateProfile } from '@/api/hooks/useProfile'

export default function PerfilScreen() {
  const { token, logout } = useAuth()
  const profile = useProfile()
  const updateProfile = useUpdateProfile()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Entre para ver seu perfil</Text>
        <Pressable style={styles.button} onPress={() => router.push('/entrar')}>
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  if (profile.isLoading || !profile.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  function startEditing() {
    setName(profile.data!.name)
    setPhone(profile.data!.phone ?? '')
    setError(null)
    setEditing(true)
  }

  async function handleSave() {
    setError(null)
    try {
      await updateProfile.mutateAsync({ name, phone })
      setEditing(false)
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Meu perfil</Text>
        {!editing && (
          <Pressable onPress={startEditing}>
            <Text style={styles.editText}>Editar</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.editActions}>
            <Pressable style={styles.button} onPress={handleSave} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Salvar</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{profile.data.name}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Telefone</Text>
            <Text style={styles.value}>{profile.data.phone ?? 'Não informado'}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <Text style={styles.value}>{profile.data.email}</Text>
          </View>
          {profile.data.city && (
            <View style={styles.field}>
              <Text style={styles.label}>Cidade</Text>
              <Text style={styles.value}>{profile.data.city}</Text>
            </View>
          )}
        </>
      )}

      <Pressable style={styles.linkRow} onPress={() => router.push('/pedidos')}>
        <Text style={styles.linkText}>Meus pedidos</Text>
      </Pressable>
      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700' },
  container: { flex: 1, padding: 24, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  editText: { color: colors.green, fontWeight: '700', fontSize: 14 },
  field: { borderBottomWidth: 1, borderBottomColor: colors.neutral200, paddingBottom: 12 },
  label: { fontSize: 12, color: colors.neutral500 },
  value: { fontSize: 15, color: colors.neutral900, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    marginTop: 4,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  cancelText: { color: colors.neutral500, fontWeight: '600' },
  error: { color: colors.red, fontSize: 13 },
  linkRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  linkText: { fontSize: 15, color: colors.neutral900, fontWeight: '600' },
  logoutButton: { marginTop: 24, alignItems: 'center' },
  logoutText: { color: colors.red, fontWeight: '700' },
})
```

Antes de aplicar, ler o arquivo atual para confirmar que `colors.green`/`colors.white`/`colors.neutral900`/`colors.neutral500`/`colors.neutral200`/`colors.red` já existem no tema (já usados no arquivo original) — não introduzir nenhum token de cor novo.

- [ ] **Step 2: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app-mobile/app/\(tabs\)/perfil.tsx
git commit -m "feat(mobile): edit name and phone from the profile screen"
```

---

### Task 6: Build final, testes completos e deploy

**Files:** nenhum novo — apenas execução e verificação.

- [ ] **Step 1: Testes e tipos do site**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Esperado: tudo passando/sem erros, rotas `/comerciante/conta` e `PUT /api/mobile/perfil` presentes.

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

- [ ] **Step 5: Deploy**

```bash
npx vercel --prod
```
Se falhar com o erro transitório `"Not authorized"`, rodar `npx vercel link --yes` e tentar de novo.

- [ ] **Step 6: Verificação manual em produção**

Usando o navegador: confirmar que `/comerciante/conta` existe e está protegida por login. Abrir o app mobile (`/app`), confirmar que a tela de perfil mostra o botão "Editar" e que o campo Telefone aparece (mesmo que "Não informado").
