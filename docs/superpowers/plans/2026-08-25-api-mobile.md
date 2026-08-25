# API Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a API JSON em `src/app/api/mobile/**` que o futuro app React Native vai consumir — login por e-mail+código ou Google, e os dados que o consumidor já usa no site (ofertas, lojas, categorias, cidades, cupons).

**Architecture:** Route Handlers do Next.js dentro do mesmo projeto (sem servidor separado), reaproveitando as funções que já existem em `src/lib/*.ts`. Autenticação por `Authorization: Bearer <token>`, sessão de 60 dias guardada em `MobileSession`.

**Tech Stack:** Next.js 14 App Router (Route Handlers), TypeScript, Prisma 7, Zod, `resend` (novo), `google-auth-library` (novo), Vitest.

## Global Constraints

- Toda resposta é JSON `{ok:true, ...}` ou `{ok:false, error:string}`, com status HTTP condizente (200 sucesso, 400 validação, 401 não-autenticado, 429 rate limit).
- Nenhum endpoint expõe `codeHash`, `tokenHash`, ou `passwordHash`.
- Todo endpoint protegido confere `blocked` "ao vivo" (consulta o banco a cada request, nunca confia só na existência do token) — mesmo padrão já usado nas Server Actions do site.
- Mensagens de erro em português, mesmo padrão de tom já usado no resto do projeto.
- `codeHash` usa `hashPassword`/`verifyPassword` de `src/lib/password.ts` (bcrypt) — não reinventa hashing.
- `tokenHash` usa SHA-256 (`node:crypto`) — token já é aleatório e de alta entropia (32 bytes), não precisa de hash lento.
- Nenhum endpoint novo duplica lógica de negócio que já existe em `src/lib/*.ts` — sempre importa e reaproveita.
- `GOOGLE_CLIENT_ID` e `RESEND_API_KEY` são variáveis de ambiente que precisam existir em produção (Vercel) antes do deploy — criar as contas (Google Cloud Console, Resend) fica fora do escopo deste plano de código, mas é pré-requisito para os testes manuais dos Tasks 4 e 6.

---

### Task 1: Schema — `passwordHash` opcional, `EmailOtp`, `MobileSession`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/auth.ts`
- Modify: `src/actions/__tests__/auth-actions.test.ts` (não deve precisar mudar — só roda pra confirmar que nada quebrou)
- Create: nova migration (nome sugerido: `add_mobile_auth`)

**Interfaces:**
- Produces: `EmailOtp` e `MobileSession` models no Prisma Client, `User.passwordHash: string | null`.
- Consumes: nada de tasks anteriores — primeiro task do plano.

- [ ] **Step 1: Editar o schema**

Em `prisma/schema.prisma`, no `model User`, trocar:
```prisma
  passwordHash String
```
por:
```prisma
  passwordHash String?
```
E adicionar a relação reversa dentro do mesmo `model User` (junto com `coupons Coupon[]` e `favorites Favorite[]` já existentes):
```prisma
  mobileSessions MobileSession[]
```

Adicionar dois models novos no final do arquivo:
```prisma
model EmailOtp {
  id        String    @id @default(cuid())
  email     String
  codeHash  String
  attempts  Int       @default(0)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([email])
  @@map("email_otps")
}

model MobileSession {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tokenHash String    @unique
  createdAt DateTime  @default(now())
  expiresAt DateTime
  revokedAt DateTime?

  @@index([userId])
  @@map("mobile_sessions")
}
```

- [ ] **Step 2: Criar e aplicar a migration**

Run: `npx prisma migrate dev --name add_mobile_auth`
Expected: migration criada em `prisma/migrations/` e aplicada no banco (o `.env` deste worktree aponta pro mesmo Neon compartilhado usado pelos outros planos — isso é esperado, não é engano). Se `migrate dev` recusar rodar em modo não-interativo neste ambiente, siga o mesmo caminho usado no plano anterior ("Admin Usuários"/"Cupons"): gerar o SQL com `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, salvar em `prisma/migrations/<timestamp>_add_mobile_auth/migration.sql`, e aplicar com `npx prisma migrate deploy`.

- [ ] **Step 3: Regenerar o Prisma Client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Atualizar `src/lib/auth.ts` pra rejeitar login sem senha**

Em `src/lib/auth.ts`, dentro do `authorize`, depois de `if (!user) return null`, adicionar a checagem antes de chamar `verifyPassword` (que agora recebe `string | null` e precisa do narrowing):

```typescript
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null
        if (!user.passwordHash) return null

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) return null

        if (user.blocked) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
```

(A única mudança real é a linha `if (!user.passwordHash) return null` logo depois do `if (!user) return null` — o resto do arquivo continua igual.)

- [ ] **Step 5: Rodar a suíte completa e checar tipos**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS, sem erros (nenhum teste existente deveria quebrar — `verifyPassword` só é chamado depois do novo guard, e nenhum teste hoje cria usuário com `passwordHash` nulo).

- [ ] **Step 6: Commitar**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/auth.ts
git commit -m "Add mobile auth schema (EmailOtp, MobileSession) and make passwordHash optional"
```

---

### Task 2: Helpers de criptografia (`src/lib/mobile-auth.ts`)

**Files:**
- Create: `src/lib/mobile-auth.ts`
- Test: `src/lib/__tests__/mobile-auth.test.ts`

**Interfaces:**
- Consumes: `hashPassword`/`verifyPassword` de `src/lib/password.ts` (já existe).
- Produces:
  - `OTP_EXPIRY_MINUTES = 5`, `MAX_OTP_ATTEMPTS = 5`, `MOBILE_SESSION_DAYS = 60` (constantes)
  - `generateOtpCode(): string` — 6 dígitos.
  - `hashOtpCode(code: string): Promise<string>`
  - `verifyOtpCode(code: string, hash: string): Promise<boolean>`
  - `generateSessionToken(): string` — 64 caracteres hex.
  - `hashSessionToken(token: string): string`
  - `addDays(date: Date, days: number): Date`
  - `addMinutes(date: Date, minutes: number): Date`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/lib/__tests__/mobile-auth.test.ts
import { describe, expect, it } from 'vitest'
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
  generateSessionToken,
  hashSessionToken,
  addDays,
  addMinutes,
} from '@/lib/mobile-auth'

describe('generateOtpCode', () => {
  it('generates a 6-digit numeric string', () => {
    const code = generateOtpCode()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('generates different codes across calls (not hardcoded)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('hashOtpCode / verifyOtpCode', () => {
  it('verifies a matching code', async () => {
    const hash = await hashOtpCode('123456')
    expect(await verifyOtpCode('123456', hash)).toBe(true)
  })

  it('rejects a non-matching code', async () => {
    const hash = await hashOtpCode('123456')
    expect(await verifyOtpCode('654321', hash)).toBe(false)
  })

  it('never stores the code in plain text', async () => {
    const hash = await hashOtpCode('123456')
    expect(hash).not.toBe('123456')
  })
})

describe('generateSessionToken', () => {
  it('generates a 64-character hex string', () => {
    const token = generateSessionToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates different tokens across calls', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken())
  })
})

describe('hashSessionToken', () => {
  it('is deterministic for the same input', () => {
    const token = generateSessionToken()
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
  })

  it('produces different hashes for different tokens', () => {
    expect(hashSessionToken(generateSessionToken())).not.toBe(hashSessionToken(generateSessionToken()))
  })
})

describe('addDays', () => {
  it('adds the given number of days', () => {
    const result = addDays(new Date('2026-01-01T00:00:00Z'), 60)
    expect(result).toEqual(new Date('2026-03-02T00:00:00Z'))
  })
})

describe('addMinutes', () => {
  it('adds the given number of minutes', () => {
    const result = addMinutes(new Date('2026-01-01T00:00:00Z'), 5)
    expect(result).toEqual(new Date('2026-01-01T00:05:00Z'))
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -- mobile-auth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/mobile-auth'`

- [ ] **Step 3: Implementar `src/lib/mobile-auth.ts`**

```typescript
import crypto from 'node:crypto'
import { hashPassword, verifyPassword } from '@/lib/password'

export const OTP_EXPIRY_MINUTES = 5
export const MAX_OTP_ATTEMPTS = 5
export const MOBILE_SESSION_DAYS = 60

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function hashOtpCode(code: string): Promise<string> {
  return hashPassword(code)
}

export async function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return verifyPassword(code, hash)
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -- mobile-auth.test.ts`
Expected: PASS (10 testes)

- [ ] **Step 5: Checar tipos e commitar**

Run: `npx tsc --noEmit`

```bash
git add src/lib/mobile-auth.ts src/lib/__tests__/mobile-auth.test.ts
git commit -m "Add mobile auth crypto helpers"
```

---

### Task 3: Sessão mobile (`src/lib/mobile-session.ts`)

**Files:**
- Create: `src/lib/mobile-session.ts`
- Test: `src/lib/__tests__/mobile-session.test.ts`

**Interfaces:**
- Consumes: `generateSessionToken`, `hashSessionToken`, `addDays`, `MOBILE_SESSION_DAYS` (Task 2).
- Produces:
  - `createMobileSession(userId: string): Promise<string>` — devolve o token em texto puro (só existe nesse momento, nunca mais).
  - `getUserFromToken(token: string): Promise<{id:string; role:string; blocked:boolean} | null>`
  - `requireMobileUser(request: Request): Promise<{userId: string} | NextResponse>` — usado por todo Route Handler protegido; se retornar `NextResponse`, o handler deve devolver essa resposta direto (já é o 401 pronto).

- [ ] **Step 1: Escrever os testes**

```typescript
// src/lib/__tests__/mobile-session.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMobileSession, getUserFromToken, requireMobileUser } from '@/lib/mobile-session'
import { prisma } from '@/lib/db'
import { hashSessionToken } from '@/lib/mobile-auth'

vi.mock('@/lib/db', () => ({
  prisma: {
    mobileSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))

describe('createMobileSession', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a session and returns the raw token', async () => {
    vi.mocked(prisma.mobileSession.create).mockResolvedValue({} as never)

    const token = await createMobileSession('user-1')

    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const data = vi.mocked(prisma.mobileSession.create).mock.calls[0][0].data
    expect(data.userId).toBe('user-1')
    expect(data.tokenHash).toBe(hashSessionToken(token))
    expect(data.tokenHash).not.toBe(token)
  })
})

describe('getUserFromToken', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no session matches', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue(null)
    const result = await getUserFromToken('any-token')
    expect(result).toBeNull()
  })

  it('returns null when the session was revoked', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: false },
    } as never)
    const result = await getUserFromToken('any-token')
    expect(result).toBeNull()
  })

  it('returns null when the session expired', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() - 1000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: false },
    } as never)
    const result = await getUserFromToken('any-token')
    expect(result).toBeNull()
  })

  it('returns null and revokes the session when the user is blocked', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: true },
    } as never)
    vi.mocked(prisma.mobileSession.update).mockResolvedValue({} as never)

    const result = await getUserFromToken('any-token')

    expect(result).toBeNull()
    expect(prisma.mobileSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sess-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    )
  })

  it('returns the user when the session is valid', async () => {
    const user = { id: 'user-1', role: 'CONSUMER', blocked: false }
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() + 100000), user,
    } as never)

    const result = await getUserFromToken('any-token')
    expect(result).toEqual(user)
  })
})

describe('requireMobileUser', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a 401 response when there is no Authorization header', async () => {
    const request = new Request('https://example.com', { headers: {} })
    const result = await requireMobileUser(request)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns a 401 response when the token does not match a valid session', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue(null)
    const request = new Request('https://example.com', { headers: { authorization: 'Bearer bad-token' } })
    const result = await requireMobileUser(request)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns the userId when the token is valid', async () => {
    vi.mocked(prisma.mobileSession.findUnique).mockResolvedValue({
      id: 'sess-1', revokedAt: null, expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', role: 'CONSUMER', blocked: false },
    } as never)
    const request = new Request('https://example.com', { headers: { authorization: 'Bearer good-token' } })
    const result = await requireMobileUser(request)
    expect(result).toEqual({ userId: 'user-1' })
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -- mobile-session.test.ts`
Expected: FAIL — `Cannot find module '@/lib/mobile-session'`

- [ ] **Step 3: Implementar `src/lib/mobile-session.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateSessionToken, hashSessionToken, addDays, MOBILE_SESSION_DAYS } from '@/lib/mobile-auth'

export type MobileUser = { id: string; role: string; blocked: boolean }

export async function createMobileSession(userId: string): Promise<string> {
  const token = generateSessionToken()
  const tokenHash = hashSessionToken(token)

  await prisma.mobileSession.create({
    data: { userId, tokenHash, expiresAt: addDays(new Date(), MOBILE_SESSION_DAYS) },
  })

  return token
}

export async function getUserFromToken(token: string): Promise<MobileUser | null> {
  const tokenHash = hashSessionToken(token)

  const session = await prisma.mobileSession.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true, blocked: true } } },
  })
  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null

  if (session.user.blocked) {
    await prisma.mobileSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
    return null
  }

  return session.user
}

export async function requireMobileUser(request: Request): Promise<{ userId: string } | NextResponse> {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
  }

  const user = await getUserFromToken(token)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
  }

  return { userId: user.id }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -- mobile-session.test.ts`
Expected: PASS (9 testes)

- [ ] **Step 5: Checar tipos e commitar**

Run: `npx tsc --noEmit`

```bash
git add src/lib/mobile-session.ts src/lib/__tests__/mobile-session.test.ts
git commit -m "Add mobile session creation, verification, and route guard"
```

---

### Task 4: E-mail + `POST /api/mobile/auth/solicitar-codigo`

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/app/api/mobile/auth/solicitar-codigo/route.ts`
- Test: `src/app/api/mobile/auth/__tests__/solicitar-codigo.test.ts`

**Interfaces:**
- Consumes: `generateOtpCode`, `hashOtpCode`, `addMinutes`, `OTP_EXPIRY_MINUTES` (Task 2).
- Produces: `sendOtpEmail(email: string, code: string): Promise<void>`.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install resend`

- [ ] **Step 2: Implementar `src/lib/email.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  await resend.emails.send({
    from: 'Aki Ofertas <login@akiofertas.com.br>',
    to: email,
    subject: 'Seu código de acesso',
    html: `<p>Seu código de acesso ao Aki Ofertas é:</p><h1 style="letter-spacing:4px">${code}</h1><p>Válido por 5 minutos.</p>`,
  })
}
```

- [ ] **Step 3: Escrever os testes do endpoint**

```typescript
// src/app/api/mobile/auth/__tests__/solicitar-codigo.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/solicitar-codigo/route'
import { prisma } from '@/lib/db'
import { sendOtpEmail } from '@/lib/email'

vi.mock('@/lib/db', () => ({
  prisma: {
    emailOtp: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/email', () => ({
  sendOtpEmail: vi.fn(),
}))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/solicitar-codigo', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/mobile/auth/solicitar-codigo', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid email', async () => {
    const response = await POST(request({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects when a code was requested in the last 60 seconds', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue({ id: 'otp-1' } as never)

    const response = await POST(request({ email: 'user@example.com' }))
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: 'Aguarde antes de pedir um novo código.' })
  })

  it('rejects when the daily limit was reached', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.emailOtp.count).mockResolvedValue(5)

    const response = await POST(request({ email: 'user@example.com' }))
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toEqual({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' })
  })

  it('creates an OTP and sends the email on success', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.emailOtp.count).mockResolvedValue(0)
    vi.mocked(prisma.emailOtp.create).mockResolvedValue({} as never)

    const response = await POST(request({ email: 'user@example.com' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })

    expect(prisma.emailOtp.create).toHaveBeenCalledTimes(1)
    const data = vi.mocked(prisma.emailOtp.create).mock.calls[0][0].data
    expect(data.email).toBe('user@example.com')
    expect(data.codeHash).not.toMatch(/^\d{6}$/)

    expect(sendOtpEmail).toHaveBeenCalledWith('user@example.com', expect.stringMatching(/^\d{6}$/))
  })
})
```

- [ ] **Step 4: Rodar os testes e confirmar que falham**

Run: `npm run test -- solicitar-codigo.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/mobile/auth/solicitar-codigo/route'`

- [ ] **Step 5: Implementar o Route Handler**

```typescript
// src/app/api/mobile/auth/solicitar-codigo/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendOtpEmail } from '@/lib/email'
import { generateOtpCode, hashOtpCode, addMinutes, OTP_EXPIRY_MINUTES } from '@/lib/mobile-auth'

const RATE_LIMIT_SECONDS = 60
const MAX_PER_DAY = 5

const bodySchema = z.object({ email: z.string().email() })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'E-mail inválido.' }, { status: 400 })
  }
  const email = parsed.data.email

  const recent = await prisma.emailOtp.findFirst({
    where: { email, createdAt: { gt: new Date(Date.now() - RATE_LIMIT_SECONDS * 1000) } },
    orderBy: { createdAt: 'desc' },
  })
  if (recent) {
    return NextResponse.json({ ok: false, error: 'Aguarde antes de pedir um novo código.' }, { status: 429 })
  }

  const countToday = await prisma.emailOtp.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  if (countToday >= MAX_PER_DAY) {
    return NextResponse.json({ ok: false, error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 })
  }

  const code = generateOtpCode()
  const codeHash = await hashOtpCode(code)
  await prisma.emailOtp.create({
    data: { email, codeHash, expiresAt: addMinutes(new Date(), OTP_EXPIRY_MINUTES) },
  })

  await sendOtpEmail(email, code)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm run test -- solicitar-codigo.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 7: Checar tipos e commitar**

Run: `npx tsc --noEmit`

```bash
git add package.json package-lock.json src/lib/email.ts src/app/api/mobile/auth/solicitar-codigo src/app/api/mobile/auth/__tests__
git commit -m "Add email sending and the request-code mobile auth endpoint"
```

---

### Task 5: `POST /api/mobile/auth/confirmar-codigo`

**Files:**
- Create: `src/app/api/mobile/auth/confirmar-codigo/route.ts`
- Test: `src/app/api/mobile/auth/__tests__/confirmar-codigo.test.ts`

**Interfaces:**
- Consumes: `verifyOtpCode`, `MAX_OTP_ATTEMPTS` (Task 2); `createMobileSession` (Task 3).
- Produces: nada que outro task consuma diretamente — endpoint terminal deste fluxo.

- [ ] **Step 1: Escrever os testes**

```typescript
// src/app/api/mobile/auth/__tests__/confirmar-codigo.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/confirmar-codigo/route'
import { prisma } from '@/lib/db'
import { verifyOtpCode } from '@/lib/mobile-auth'
import { createMobileSession } from '@/lib/mobile-session'

vi.mock('@/lib/db', () => ({
  prisma: {
    emailOtp: { findFirst: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/mobile-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mobile-auth')>('@/lib/mobile-auth')
  return { ...actual, verifyOtpCode: vi.fn() }
})

vi.mock('@/lib/mobile-session', () => ({
  createMobileSession: vi.fn(),
}))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/confirmar-codigo', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validOtp = { id: 'otp-1', email: 'user@example.com', codeHash: 'hash', attempts: 0, expiresAt: new Date(Date.now() + 100000) }

describe('POST /api/mobile/auth/confirmar-codigo', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid body', async () => {
    const response = await POST(request({ email: 'not-an-email', code: '123456' }))
    expect(response.status).toBe(400)
  })

  it('rejects when there is no pending code for the email', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(null)
    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Código inválido.' })
  })

  it('rejects an expired code', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue({ ...validOtp, expiresAt: new Date(Date.now() - 1000) } as never)
    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Código expirado.' })
  })

  it('rejects after too many failed attempts', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue({ ...validOtp, attempts: 5 } as never)
    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Código inválido.' })
  })

  it('increments attempts on a wrong code', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(false)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)

    const response = await POST(request({ email: 'user@example.com', code: '000000' }))

    expect(response.status).toBe(400)
    expect(prisma.emailOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'otp-1' }, data: { attempts: { increment: 1 } } }),
    )
  })

  it('rejects a new user without a name', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Informe seu nome.' })
  })

  it('creates a new user and returns a token', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ email: 'user@example.com', code: '123456', name: 'Maria' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true, token: 'a-token', user: { id: 'user-1', name: 'Maria', email: 'user@example.com' },
    })
    const data = vi.mocked(prisma.user.create).mock.calls[0][0].data
    expect(data.role).toBe('CONSUMER')
    expect(data.passwordHash).toBeNull()
  })

  it('logs in an existing user without requiring a name', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(200)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a blocked user', async () => {
    vi.mocked(prisma.emailOtp.findFirst).mockResolvedValue(validOtp as never)
    vi.mocked(verifyOtpCode).mockResolvedValue(true)
    vi.mocked(prisma.emailOtp.update).mockResolvedValue({} as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: true } as never)

    const response = await POST(request({ email: 'user@example.com', code: '123456' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Conta bloqueada.' })
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -- confirmar-codigo.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar o Route Handler**

```typescript
// src/app/api/mobile/auth/confirmar-codigo/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyOtpCode, MAX_OTP_ATTEMPTS } from '@/lib/mobile-auth'
import { createMobileSession } from '@/lib/mobile-session'

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
  name: z.string().min(2).optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }
  const { email, code, name } = parsed.data

  const otp = await prisma.emailOtp.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!otp) {
    return NextResponse.json({ ok: false, error: 'Código inválido.' }, { status: 400 })
  }
  if (otp.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: 'Código expirado.' }, { status: 400 })
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: 'Código inválido.' }, { status: 400 })
  }

  const valid = await verifyOtpCode(code, otp.codeHash)
  if (!valid) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    return NextResponse.json({ ok: false, error: 'Código inválido.' }, { status: 400 })
  }

  await prisma.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } })

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    if (!name) {
      return NextResponse.json({ ok: false, error: 'Informe seu nome.' }, { status: 400 })
    }
    user = await prisma.user.create({
      data: { email, name, role: 'CONSUMER', passwordHash: null },
    })
  }
  if (user.blocked) {
    return NextResponse.json({ ok: false, error: 'Conta bloqueada.' }, { status: 401 })
  }

  const token = await createMobileSession(user.id)

  return NextResponse.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } })
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -- confirmar-codigo.test.ts`
Expected: PASS (9 testes)

- [ ] **Step 5: Checar tipos e commitar**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/mobile/auth/confirmar-codigo src/app/api/mobile/auth/__tests__/confirmar-codigo.test.ts
git commit -m "Add the confirm-code mobile auth endpoint"
```

---

### Task 6: Login com Google (`src/lib/google-auth.ts` + `POST /api/mobile/auth/google`)

**Files:**
- Create: `src/lib/google-auth.ts`
- Create: `src/app/api/mobile/auth/google/route.ts`
- Test: `src/app/api/mobile/auth/__tests__/google.test.ts`

**Interfaces:**
- Consumes: `createMobileSession` (Task 3).
- Produces: `verifyGoogleIdToken(idToken: string): Promise<{email:string; name:string} | null>`.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install google-auth-library`

- [ ] **Step 2: Implementar `src/lib/google-auth.ts`**

```typescript
import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export type GoogleProfile = { email: string; name: string }

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) return null
    return { email: payload.email, name: payload.name ?? payload.email.split('@')[0] }
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Escrever os testes do endpoint**

```typescript
// src/app/api/mobile/auth/__tests__/google.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mobile/auth/google/route'
import { prisma } from '@/lib/db'
import { verifyGoogleIdToken } from '@/lib/google-auth'
import { createMobileSession } from '@/lib/mobile-session'

vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/google-auth', () => ({ verifyGoogleIdToken: vi.fn() }))
vi.mock('@/lib/mobile-session', () => ({ createMobileSession: vi.fn() }))

function request(body: unknown) {
  return new Request('https://example.com/api/mobile/auth/google', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/mobile/auth/google', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid body', async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
  })

  it('rejects when the Google token cannot be verified', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue(null)
    const response = await POST(request({ idToken: 'bad-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Não foi possível verificar o login do Google.' })
  })

  it('creates a new user from the Google profile', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ idToken: 'good-token' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true, token: 'a-token', user: { id: 'user-1', name: 'Maria', email: 'user@example.com' },
    })
    const data = vi.mocked(prisma.user.create).mock.calls[0][0].data
    expect(data.role).toBe('CONSUMER')
    expect(data.passwordHash).toBeNull()
  })

  it('logs in an existing user', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: false } as never)
    vi.mocked(createMobileSession).mockResolvedValue('a-token')

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(200)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a blocked user', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({ email: 'user@example.com', name: 'Maria' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', blocked: true } as never)

    const response = await POST(request({ idToken: 'good-token' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: 'Conta bloqueada.' })
  })
})
```

- [ ] **Step 4: Rodar os testes e confirmar que falham**

Run: `npm run test -- google.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 5: Implementar o Route Handler**

```typescript
// src/app/api/mobile/auth/google/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyGoogleIdToken } from '@/lib/google-auth'
import { createMobileSession } from '@/lib/mobile-session'

const bodySchema = z.object({ idToken: z.string().min(1) })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const profile = await verifyGoogleIdToken(parsed.data.idToken)
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Não foi possível verificar o login do Google.' }, { status: 401 })
  }

  let user = await prisma.user.findUnique({ where: { email: profile.email } })
  if (!user) {
    user = await prisma.user.create({
      data: { email: profile.email, name: profile.name, role: 'CONSUMER', passwordHash: null },
    })
  }
  if (user.blocked) {
    return NextResponse.json({ ok: false, error: 'Conta bloqueada.' }, { status: 401 })
  }

  const token = await createMobileSession(user.id)

  return NextResponse.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } })
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm run test -- google.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 7: Checar tipos e commitar**

Run: `npx tsc --noEmit`

```bash
git add package.json package-lock.json src/lib/google-auth.ts src/app/api/mobile/auth/google src/app/api/mobile/auth/__tests__/google.test.ts
git commit -m "Add Google sign-in mobile auth endpoint"
```

---

### Task 7: Cupons via API (refatorar `generateCoupon` + 2 endpoints)

**Files:**
- Modify: `src/actions/coupon-actions.ts`
- Create: `src/app/api/mobile/cupons/gerar/route.ts`
- Create: `src/app/api/mobile/cupons/route.ts`
- Test: `src/app/api/mobile/cupons/__tests__/gerar.test.ts`
- Test: `src/app/api/mobile/cupons/__tests__/listar.test.ts`

**Interfaces:**
- Consumes: `requireMobileUser` (Task 3), `getCouponsForUser` (já existe em `src/lib/coupons.ts`).
- Produces: `generateCouponForUser(userId: string, offerId: string): Promise<CouponResult>` (exportada de `coupon-actions.ts`, reaproveitável por qualquer chamador que já tenha o `userId` resolvido).

- [ ] **Step 1: Refatorar `generateCoupon` em `src/actions/coupon-actions.ts`**

Hoje a função inteira (do `const userId = ...` até o fim do loop de retry) fica dentro de `generateCoupon`. Separar em duas: `generateCoupon` vira um wrapper fino que só resolve a sessão do site e delega; `generateCouponForUser` ganha o `userId` como parâmetro e faz todo o resto (idêntico ao que já existe hoje, só trocando a variável fechada `userId` por um parâmetro).

Trocar:
```typescript
export async function generateCoupon(offerId: string): Promise<CouponResult> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: 'Não autorizado.' }
  }
  const userId = session.user.id as string

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
```
por:
```typescript
export async function generateCoupon(offerId: string): Promise<CouponResult> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, error: 'Não autorizado.' }
  }
  return generateCouponForUser(session.user.id as string, offerId)
}

export async function generateCouponForUser(userId: string, offerId: string): Promise<CouponResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
```

Nada mais no corpo da função muda — o resto do loop de retry, a transação, e o `return { ok: false, error: GENERATE_FAILED }` no final da função continuam exatamente iguais, só que agora dentro de `generateCouponForUser` em vez de `generateCoupon`.

- [ ] **Step 2: Rodar a suíte existente de `coupon-actions.test.ts` e confirmar que ainda passa**

Run: `npm run test -- coupon-actions.test.ts`
Expected: PASS, sem nenhuma mudança nos testes existentes — `generateCoupon` continua com a mesma assinatura e comportamento pra quem já a chama.

- [ ] **Step 3: Escrever os testes dos dois endpoints novos**

```typescript
// src/app/api/mobile/cupons/__tests__/gerar.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from '@/app/api/mobile/cupons/gerar/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { generateCouponForUser } from '@/actions/coupon-actions'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/actions/coupon-actions', () => ({ generateCouponForUser: vi.fn() }))

function request(body: unknown, authorized = true) {
  return new Request('https://example.com/api/mobile/cupons/gerar', {
    method: 'POST',
    headers: authorized ? { authorization: 'Bearer token' } : {},
    body: JSON.stringify(body),
  })
}

describe('POST /api/mobile/cupons/gerar', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await POST(request({ offerId: 'offer-1' }, false))
    expect(response.status).toBe(401)
  })

  it('rejects invalid body', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    const response = await POST(request({}))
    expect(response.status).toBe(400)
  })

  it('generates the coupon for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(generateCouponForUser).mockResolvedValue({ ok: true, coupon: { id: 'c1', code: 'AK1234', expiresAt: new Date() } })

    const response = await POST(request({ offerId: 'offer-1' }))

    expect(response.status).toBe(200)
    expect(generateCouponForUser).toHaveBeenCalledWith('user-1', 'offer-1')
  })

  it('surfaces a business error from generateCouponForUser with a 400', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(generateCouponForUser).mockResolvedValue({ ok: false, error: 'Esta oferta esgotou.' })

    const response = await POST(request({ offerId: 'offer-1' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: 'Esta oferta esgotou.' })
  })
})
```

```typescript
// src/app/api/mobile/cupons/__tests__/listar.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from '@/app/api/mobile/cupons/route'
import { requireMobileUser } from '@/lib/mobile-session'
import { getCouponsForUser } from '@/lib/coupons'

vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/coupons', () => ({ getCouponsForUser: vi.fn() }))

describe('GET /api/mobile/cupons', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await GET(new Request('https://example.com/api/mobile/cupons'))
    expect(response.status).toBe(401)
  })

  it('returns the coupons for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(getCouponsForUser).mockResolvedValue([{ id: 'c1' }] as never)

    const response = await GET(new Request('https://example.com/api/mobile/cupons'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'c1' }] })
    expect(getCouponsForUser).toHaveBeenCalledWith('user-1')
  })
})
```

- [ ] **Step 4: Rodar os testes e confirmar que falham**

Run: `npm run test -- gerar.test.ts listar.test.ts`
Expected: FAIL — módulos não existem

- [ ] **Step 5: Implementar os dois Route Handlers**

```typescript
// src/app/api/mobile/cupons/gerar/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMobileUser } from '@/lib/mobile-session'
import { generateCouponForUser } from '@/actions/coupon-actions'

const bodySchema = z.object({ offerId: z.string().min(1) })

export async function POST(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const result = await generateCouponForUser(auth.userId, parsed.data.offerId)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
```

```typescript
// src/app/api/mobile/cupons/route.ts
import { NextResponse } from 'next/server'
import { requireMobileUser } from '@/lib/mobile-session'
import { getCouponsForUser } from '@/lib/coupons'

export async function GET(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const data = await getCouponsForUser(auth.userId)
  return NextResponse.json({ ok: true, data })
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm run test -- gerar.test.ts listar.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 7: Checar tipos, rodar a suíte completa e commitar**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros; suíte completa passando (nenhuma regressão em `coupon-actions.test.ts` ou em qualquer outro arquivo)

```bash
git add src/actions/coupon-actions.ts src/app/api/mobile/cupons
git commit -m "Extract generateCouponForUser and add mobile coupon endpoints"
```

---

### Task 8: Endpoints de dados (ofertas, lojas, categorias, cidades, perfil)

**Files:**
- Create: `src/lib/mobile-location.ts`
- Create: `src/app/api/mobile/ofertas/destaque/route.ts`
- Create: `src/app/api/mobile/ofertas/route.ts`
- Create: `src/app/api/mobile/ofertas/[slug]/route.ts`
- Create: `src/app/api/mobile/lojas/[slug]/route.ts`
- Create: `src/app/api/mobile/categorias/route.ts`
- Create: `src/app/api/mobile/cidades/route.ts`
- Create: `src/app/api/mobile/perfil/route.ts`
- Test: `src/app/api/mobile/__tests__/data-endpoints.test.ts`

**Interfaces:**
- Consumes: `getFeaturedOffers`, `getOffersList`, `getOfferBySlug` (`src/lib/offers.ts`), `getBusinessBySlug` (`src/lib/businesses.ts`), `getActiveCategories`, `getActiveCities` (`src/lib/categories.ts`), `requireMobileUser` (Task 3). Todas já existem, nenhuma muda.
- Produces: `parseLocationParams(searchParams: URLSearchParams): {location: Coordinates|null; city: CityCookie|null}` — mesma regra de precedência já usada em `(consumer)/page.tsx` (`location` manda; `city` só é usado quando não há `location`).

- [ ] **Step 1: Implementar `src/lib/mobile-location.ts`**

```typescript
import type { Coordinates, CityCookie } from '@/lib/location'

export function parseLocationParams(searchParams: URLSearchParams): {
  location: Coordinates | null
  city: CityCookie | null
} {
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const location =
    lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : null

  const cidade = searchParams.get('cidade')
  const [name, state] = cidade?.split('|') ?? []
  const city = !location && name && state ? { name, state } : null

  return { location, city }
}
```

- [ ] **Step 2: Escrever os testes (helper + todos os endpoints deste task, em um único arquivo)**

```typescript
// src/app/api/mobile/__tests__/data-endpoints.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { parseLocationParams } from '@/lib/mobile-location'
import { GET as getDestaque } from '@/app/api/mobile/ofertas/destaque/route'
import { GET as getOfertas } from '@/app/api/mobile/ofertas/route'
import { GET as getOferta } from '@/app/api/mobile/ofertas/[slug]/route'
import { GET as getLoja } from '@/app/api/mobile/lojas/[slug]/route'
import { GET as getCategorias } from '@/app/api/mobile/categorias/route'
import { GET as getCidades } from '@/app/api/mobile/cidades/route'
import { GET as getPerfil } from '@/app/api/mobile/perfil/route'
import { getFeaturedOffers, getOffersList, getOfferBySlug } from '@/lib/offers'
import { getBusinessBySlug } from '@/lib/businesses'
import { getActiveCategories, getActiveCities } from '@/lib/categories'
import { requireMobileUser } from '@/lib/mobile-session'
import { prisma } from '@/lib/db'

vi.mock('@/lib/offers', () => ({
  getFeaturedOffers: vi.fn(),
  getOffersList: vi.fn(),
  getOfferBySlug: vi.fn(),
}))
vi.mock('@/lib/businesses', () => ({ getBusinessBySlug: vi.fn() }))
vi.mock('@/lib/categories', () => ({ getActiveCategories: vi.fn(), getActiveCities: vi.fn() }))
vi.mock('@/lib/mobile-session', () => ({ requireMobileUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }))

describe('parseLocationParams', () => {
  it('parses lat/lng when both are present', () => {
    const result = parseLocationParams(new URLSearchParams('lat=-25.9&lng=-53.05'))
    expect(result).toEqual({ location: { lat: -25.9, lng: -53.05 }, city: null })
  })

  it('parses cidade when there is no location', () => {
    const result = parseLocationParams(new URLSearchParams('cidade=Marmeleiro|PR'))
    expect(result).toEqual({ location: null, city: { name: 'Marmeleiro', state: 'PR' } })
  })

  it('prefers location over cidade when both are present', () => {
    const result = parseLocationParams(new URLSearchParams('lat=-25.9&lng=-53.05&cidade=Marmeleiro|PR'))
    expect(result.location).not.toBeNull()
    expect(result.city).toBeNull()
  })

  it('returns nulls when neither is present', () => {
    const result = parseLocationParams(new URLSearchParams())
    expect(result).toEqual({ location: null, city: null })
  })
})

describe('GET /api/mobile/ofertas/destaque', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns featured offers', async () => {
    vi.mocked(getFeaturedOffers).mockResolvedValue([{ id: 'o1' }] as never)
    const response = await getDestaque(new Request('https://example.com/api/mobile/ofertas/destaque?lat=-25.9&lng=-53.05'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'o1' }] })
    expect(getFeaturedOffers).toHaveBeenCalledWith({ location: { lat: -25.9, lng: -53.05 }, city: null, limit: 10 })
  })
})

describe('GET /api/mobile/ofertas', () => {
  afterEach(() => vi.clearAllMocks())

  it('passes categoria and raio through to getOffersList', async () => {
    vi.mocked(getOffersList).mockResolvedValue([] as never)
    const response = await getOfertas(new Request('https://example.com/api/mobile/ofertas?categoria=cat-1&raio=5'))
    expect(response.status).toBe(200)
    expect(getOffersList).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1', radiusKm: 5 }),
    )
  })
})

describe('GET /api/mobile/ofertas/[slug]', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns 404 when the offer does not exist', async () => {
    vi.mocked(getOfferBySlug).mockResolvedValue(null)
    const response = await getOferta(new Request('https://example.com/api/mobile/ofertas/nope'), { params: { slug: 'nope' } })
    expect(response.status).toBe(404)
  })

  it('returns the offer when it exists', async () => {
    vi.mocked(getOfferBySlug).mockResolvedValue({ id: 'o1' } as never)
    const response = await getOferta(new Request('https://example.com/api/mobile/ofertas/combo'), { params: { slug: 'combo' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { id: 'o1' } })
  })
})

describe('GET /api/mobile/lojas/[slug]', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns 404 when the business does not exist', async () => {
    vi.mocked(getBusinessBySlug).mockResolvedValue(null)
    const response = await getLoja(new Request('https://example.com/api/mobile/lojas/nope'), { params: { slug: 'nope' } })
    expect(response.status).toBe(404)
  })

  it('returns the business when it exists', async () => {
    vi.mocked(getBusinessBySlug).mockResolvedValue({ id: 'b1' } as never)
    const response = await getLoja(new Request('https://example.com/api/mobile/lojas/big-burger'), { params: { slug: 'big-burger' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { id: 'b1' } })
  })
})

describe('GET /api/mobile/categorias', () => {
  it('returns active categories', async () => {
    vi.mocked(getActiveCategories).mockResolvedValue([{ id: 'c1' }] as never)
    const response = await getCategorias()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'c1' }] })
  })
})

describe('GET /api/mobile/cidades', () => {
  it('returns active cities', async () => {
    vi.mocked(getActiveCities).mockResolvedValue([{ id: 'ci1' }] as never)
    const response = await getCidades()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: [{ id: 'ci1' }] })
  })
})

describe('GET /api/mobile/perfil', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the 401 from requireMobileUser when unauthenticated', async () => {
    const unauthorized = NextResponse.json({ ok: false, error: 'Sessão expirada.' }, { status: 401 })
    vi.mocked(requireMobileUser).mockResolvedValue(unauthorized)

    const response = await getPerfil(new Request('https://example.com/api/mobile/perfil'))
    expect(response.status).toBe(401)
  })

  it('returns the profile for the authenticated user', async () => {
    vi.mocked(requireMobileUser).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'user@example.com', city: 'Marmeleiro' } as never)

    const response = await getPerfil(new Request('https://example.com/api/mobile/perfil'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true, data: { id: 'user-1', name: 'Maria', email: 'user@example.com', city: 'Marmeleiro' },
    })
  })
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm run test -- data-endpoints.test.ts`
Expected: FAIL — os Route Handlers ainda não existem

- [ ] **Step 4: Implementar os sete Route Handlers**

```typescript
// src/app/api/mobile/ofertas/destaque/route.ts
import { NextResponse } from 'next/server'
import { getFeaturedOffers } from '@/lib/offers'
import { parseLocationParams } from '@/lib/mobile-location'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { location, city } = parseLocationParams(searchParams)

  const data = await getFeaturedOffers({ location, city, limit: 10 })
  return NextResponse.json({ ok: true, data })
}
```

```typescript
// src/app/api/mobile/ofertas/route.ts
import { NextResponse } from 'next/server'
import { getOffersList } from '@/lib/offers'
import { parseLocationParams } from '@/lib/mobile-location'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { location, city } = parseLocationParams(searchParams)
  const categoryId = searchParams.get('categoria') ?? undefined
  const raio = searchParams.get('raio')
  const radiusKm = raio && !Number.isNaN(Number(raio)) ? Number(raio) : undefined

  const data = await getOffersList({ categoryId, location, city, radiusKm })
  return NextResponse.json({ ok: true, data })
}
```

```typescript
// src/app/api/mobile/ofertas/[slug]/route.ts
import { NextResponse } from 'next/server'
import { getOfferBySlug } from '@/lib/offers'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const offer = await getOfferBySlug(params.slug)
  if (!offer) {
    return NextResponse.json({ ok: false, error: 'Oferta não encontrada.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, data: offer })
}
```

```typescript
// src/app/api/mobile/lojas/[slug]/route.ts
import { NextResponse } from 'next/server'
import { getBusinessBySlug } from '@/lib/businesses'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const business = await getBusinessBySlug(params.slug)
  if (!business) {
    return NextResponse.json({ ok: false, error: 'Loja não encontrada.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, data: business })
}
```

```typescript
// src/app/api/mobile/categorias/route.ts
import { NextResponse } from 'next/server'
import { getActiveCategories } from '@/lib/categories'

export async function GET() {
  const data = await getActiveCategories()
  return NextResponse.json({ ok: true, data })
}
```

```typescript
// src/app/api/mobile/cidades/route.ts
import { NextResponse } from 'next/server'
import { getActiveCities } from '@/lib/categories'

export async function GET() {
  const data = await getActiveCities()
  return NextResponse.json({ ok: true, data })
}
```

```typescript
// src/app/api/mobile/perfil/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireMobileUser } from '@/lib/mobile-session'

export async function GET(request: Request) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, city: true },
  })

  return NextResponse.json({ ok: true, data: user })
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm run test -- data-endpoints.test.ts`
Expected: PASS (13 testes)

- [ ] **Step 6: Checar tipos, rodar a suíte completa, build, e commitar**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: sem erros; suíte completa passando; build lista todas as rotas `/api/mobile/**` novas.

```bash
git add src/lib/mobile-location.ts src/app/api/mobile/ofertas src/app/api/mobile/lojas src/app/api/mobile/categorias src/app/api/mobile/cidades src/app/api/mobile/perfil src/app/api/mobile/__tests__
git commit -m "Add public and profile mobile data endpoints"
```
