# Aplicar Limites dos Planos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limite de ofertas ativas por plano em `createOffer`, e ordenação da Home por preço do plano da loja em `getFeaturedOffers` — os dois benefícios pagos que a landing já promete, aplicados de verdade.

**Architecture:** Duas mudanças pequenas e independentes, sem schema novo. Ver `docs/superpowers/specs/2026-08-28-plan-enforcement-design.md` pro raciocínio completo.

**Tech Stack:** Next.js 14 (server actions), Prisma, Vitest.

## Global Constraints

- Nenhum campo novo no banco — usa `Plan.maxOffersPerMonth` e `Plan.priceCents`, já existentes.
- A ordenação por plano se aplica só a `getFeaturedOffers` (Home, site + mobile). `getOffersList` (busca em `/ofertas`) não muda.
- Nenhuma oferta é excluída da Home por plano — só a ordem muda.
- O limite de ofertas só considera `status: 'ACTIVE'`. Único ponto de enforcement é `createOffer` (não existe fluxo de reativar oferta cancelada).
- Mensagem de erro do limite, verbatim: `` `Você atingiu o limite de ${maxOffersPerMonth} ofertas ativas do seu plano. Desative uma oferta ou assine um plano maior pra criar mais.` ``
- Se `business.plan` for `null`, nenhum dos dois mecanismos é aplicado (loja tratada como prioridade mínima na Home, sem limite de ofertas).

---

### Task 1: Limite de ofertas ativas por plano

**Files:**
- Modify: `src/actions/offer-actions.ts`
- Modify: `src/actions/__tests__/offer-actions.test.ts`

**Interfaces:**
- Consumes: `Business.plan` (relação já existente no schema, campo `maxOffersPerMonth` em `Plan`).
- Produces: nenhuma interface nova — `createOffer` mantém a mesma assinatura (`(input: OfferActionInput) => Promise<OfferResult>`), só ganha um novo caminho de rejeição.

- [ ] **Step 1: Escrever os testes novos**

Em `src/actions/__tests__/offer-actions.test.ts`, adicionar `offer: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), count: vi.fn() }` ao mock de `@/lib/db` (só adiciona `count` ao objeto `offer` que já existe — não mexe em `business`). Adicionar, próximo às outras fixtures de negócio (não reaproveitar `unblockedBusiness` — os testes existentes que usam essa fixture não devem ganhar `plan`, pra não precisarem mockar `offer.count`):

```typescript
const businessAtLimit = { id: 'biz-1', owner: { id: 'u1', blocked: false }, plan: { maxOffersPerMonth: 5 } }
const businessBelowLimit = { id: 'biz-1', owner: { id: 'u1', blocked: false }, plan: { maxOffersPerMonth: 5 } }
```

Dentro do `describe('createOffer', ...)` existente, adicionar:

```typescript
  it('rejects creating an offer when the business already has the max active offers for its plan', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(businessAtLimit as never)
    vi.mocked(prisma.offer.count).mockResolvedValue(5)

    const result = await createOffer(validInput)

    expect(result).toEqual({
      ok: false,
      error: 'Você atingiu o limite de 5 ofertas ativas do seu plano. Desative uma oferta ou assine um plano maior pra criar mais.',
    })
    expect(prisma.offer.create).not.toHaveBeenCalled()
    expect(prisma.offer.count).toHaveBeenCalledWith({ where: { businessId: 'biz-1', status: 'ACTIVE' } })
  })

  it('creates the offer when the business is below its plan limit', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue(businessBelowLimit as never)
    vi.mocked(prisma.offer.count).mockResolvedValue(3)
    vi.mocked(prisma.offer.create).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await createOffer(validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    expect(prisma.offer.create).toHaveBeenCalled()
  })

  it('does not check the limit when the business has no plan', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' } } as never)
    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: 'biz-1', owner: { id: 'u1', blocked: false }, plan: null } as never)
    vi.mocked(prisma.offer.create).mockResolvedValue({ id: 'offer-1' } as never)

    const result = await createOffer(validInput)

    expect(result).toEqual({ ok: true, offerId: 'offer-1' })
    expect(prisma.offer.count).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run src/actions/__tests__/offer-actions.test.ts`
Expected: FAIL — os 3 testes novos falham (`business.plan` não existe na lógica atual de `createOffer`, `prisma.offer.count` nunca é chamado).

- [ ] **Step 3: Incluir `plan` na consulta de `requireMerchantBusiness`**

Em `src/actions/offer-actions.ts`, dentro de `requireMerchantBusiness`, trocar:

```typescript
  const business = await prisma.business.findFirst({
    where: { ownerId: session.user.id as string },
    include: { owner: { select: { blocked: true } } },
  })
```

por:

```typescript
  const business = await prisma.business.findFirst({
    where: { ownerId: session.user.id as string },
    include: { owner: { select: { blocked: true } }, plan: true },
  })
```

- [ ] **Step 4: Aplicar o limite em `createOffer`**

Em `createOffer`, logo depois do bloco `const computed = parseOfferInput(parsed.data)` / checagem de erro, antes de `const slug = ...`:

```typescript
  if (business.plan) {
    const activeCount = await prisma.offer.count({ where: { businessId: business.id, status: 'ACTIVE' } })
    if (activeCount >= business.plan.maxOffersPerMonth) {
      return {
        ok: false,
        error: `Você atingiu o limite de ${business.plan.maxOffersPerMonth} ofertas ativas do seu plano. Desative uma oferta ou assine um plano maior pra criar mais.`,
      }
    }
  }
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npx vitest run src/actions/__tests__/offer-actions.test.ts`
Expected: PASS (todos os testes, incluindo os já existentes que usam `unblockedBusiness` sem `plan`).

- [ ] **Step 6: Rodar o typecheck e a suíte completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/actions/offer-actions.ts src/actions/__tests__/offer-actions.test.ts
git commit -m "feat: enforce active offer limit per plan on createOffer"
```

---

### Task 2: Ordenação da Home por preço do plano

**Files:**
- Modify: `src/lib/offers.ts`
- Modify: `src/lib/__tests__/offers.test.ts`

**Interfaces:**
- Consumes: `Business.plan.priceCents` (relação já existente).
- Produces: nenhuma mudança de assinatura em `getFeaturedOffers` — mesmo input/output, só muda a ordem do array retornado.

- [ ] **Step 1: Escrever os testes novos**

Em `src/lib/__tests__/offers.test.ts`, adicionar duas fixtures de negócio com plano, próximas às existentes (`bigBurger`/`farBusiness`):

```typescript
const proBusiness = { ...bigBurger, id: 'biz-5', slug: 'pro-business', plan: { priceCents: 19990 } }
const freeBusiness = { ...farBusiness, id: 'biz-6', slug: 'free-business', plan: null }
```

E duas ofertas usando essas lojas:

```typescript
const proOffer = { id: 'offer-5', slug: 'oferta-pro', title: 'Oferta Pro', imageUrl: null, originalPrice: 2000, discountPrice: 1500, discountPercent: 25, createdAt: new Date('2026-01-05'), startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'), business: proBusiness }
const freeOffer = { id: 'offer-6', slug: 'oferta-free', title: 'Oferta Free', imageUrl: null, originalPrice: 2000, discountPrice: 1500, discountPercent: 25, createdAt: new Date('2026-01-06'), startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'), business: freeBusiness }
```

Dentro do `describe('getFeaturedOffers', ...)` existente:

```typescript
  it('orders by the business plan price, highest first, regardless of location', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([freeOffer, proOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(result.map((o) => o.id)).toEqual(['offer-5', 'offer-6'])
  })

  it('treats a business with no plan as the lowest priority', async () => {
    vi.mocked(prisma.offer.findMany).mockResolvedValue([proOffer, freeOffer] as never)

    const result = await getFeaturedOffers({ location: null, limit: 10 })

    expect(result.map((o) => o.id)).toEqual(['offer-5', 'offer-6'])
  })
```

O caso "desempate por distância dentro do mesmo preço de plano" já é coberto pelo teste existente `'sorts by distance ascending when a location is given'` (nem `farOffer` nem `nearOffer` têm `plan`, então empatam em `priceCents: 0` e caem no desempate por distância) — não precisa de um teste novo pra isso, só os dois acima.

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run src/lib/__tests__/offers.test.ts`
Expected: FAIL — a ordenação por plano ainda não existe (o primeiro e o terceiro teste novo falham).

- [ ] **Step 3: Incluir o plano na consulta e reescrever a ordenação**

Em `src/lib/offers.ts`, dentro de `getFeaturedOffers`, trocar:

```typescript
  const rows = await prisma.offer.findMany({
    where: { /* ... inalterado ... */ },
    orderBy: { createdAt: 'desc' },
    include: { business: true },
  })

  const ratings = await getRatingsForBusinesses(Array.from(new Set(rows.map((row) => row.business.id))))
  const items = rows.map((row) => toOfferListItem(row, row.business, input.location, ratings.get(row.business.id) ?? null))

  if (input.location) {
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
  }

  return items.slice(0, input.limit)
```

por:

```typescript
  const rows = await prisma.offer.findMany({
    where: { /* ... inalterado ... */ },
    orderBy: { createdAt: 'desc' },
    include: { business: { include: { plan: true } } },
  })

  const ratings = await getRatingsForBusinesses(Array.from(new Set(rows.map((row) => row.business.id))))
  const items = rows.map((row) => toOfferListItem(row, row.business, input.location, ratings.get(row.business.id) ?? null))
  const priceCentsByOfferId = new Map(rows.map((row) => [row.id, row.business.plan?.priceCents ?? 0]))

  items.sort((a, b) => {
    const planDiff = (priceCentsByOfferId.get(b.id) ?? 0) - (priceCentsByOfferId.get(a.id) ?? 0)
    if (planDiff !== 0) return planDiff
    if (input.location) return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    return 0
  })

  return items.slice(0, input.limit)
```

(Note: `BusinessRow`, o tipo usado por `toOfferListItem`, não precisa mudar — ele já é estruturalmente compatível com o retorno do Prisma incluindo `plan`, já que TypeScript permite campos extras. Confirme com `tsc` no Step 5.)

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run src/lib/__tests__/offers.test.ts`
Expected: PASS (todos os testes, incluindo os já existentes — nenhuma fixture antiga tem `plan`, então `priceCents` cai pra 0 em todos, empate, cai no desempate de sempre).

- [ ] **Step 5: Rodar o typecheck e a suíte completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/lib/offers.ts src/lib/__tests__/offers.test.ts
git commit -m "feat: order the home featured offers by the business plan price"
```

---

### Task 3: Verificação e deploy

**Files:** nenhum arquivo novo — task de verificação e publicação.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 2: Verificação manual no browser**

Iniciar o dev server (`preview_start` com `aki-ofertas-dev`). Como só existe uma loja seed hoje (Big Burger, no plano Básico), não dá pra ver a reordenação de verdade sem mais dados — criar temporariamente, via script Node com o `prisma` do projeto (mesmo padrão já usado nesta sessão), uma segunda loja de teste num plano mais caro com uma oferta ativa, confirmar que ela aparece primeiro na Home (`/` com cookie de cidade/localização), depois desfazer (deletar a loja/oferta de teste). Confirmar também que criar uma 6ª oferta ativa numa loja no plano Básico (limite 5) é bloqueado com a mensagem certa em `/comerciante/ofertas/nova`.

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build limpo, sem erros.

- [ ] **Step 4: Deploy**

Run: `npx vercel --prod`

- [ ] **Step 5: Verificação ao vivo em produção**

Via Browser tool: confirmar que a Home carrega normalmente em produção sem erros de console, e que criar oferta continua funcionando pra loja seed (ainda abaixo do limite).
