# Aplicar Limites dos Planos — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Fazer os 3 planos pagos (Básico/Destaque/Turbo) terem efeito de verdade: limite de ofertas ativas por plano, e preferência de posição na Home proporcional ao plano da loja — os dois benefícios que a landing já promete desde a integração com o Asaas, mas que hoje são só texto.

**Architecture:** Duas mudanças independentes e pequenas, sem schema novo. (1) `createOffer` passa a checar `business.plan.maxOffersPerMonth` antes de criar. (2) `getFeaturedOffers` passa a ordenar por `business.plan.priceCents` (decrescente) como critério primário, mantendo distância/data como critério de desempate — sem excluir nenhuma oferta da lista.

**Tech Stack:** Next.js 14 (server actions, App Router), Prisma.

## Global Constraints

- Nenhum campo novo no schema — os dois mecanismos usam dados que já existem (`Plan.maxOffersPerMonth`, `Plan.priceCents`).
- A ordenação por plano se aplica **só** à Home (`getFeaturedOffers`, compartilhada pelo site e pelo endpoint mobile `/api/mobile/ofertas/destaque`). A busca (`getOffersList`, rota `/ofertas`) continua neutra, sem viés de plano.
- Nenhuma oferta é excluída da Home por causa do plano — é só uma questão de ordem. Enquanto poucas lojas tiverem plano pago, ofertas de lojas no Grátis continuam preenchendo a Home normalmente.
- O limite de ofertas conta só ofertas com `status: 'ACTIVE'` da própria loja — não existe hoje um fluxo de "reativar" oferta cancelada (só criar ou cancelar), então o único ponto de enforcement é `createOffer`.
- Mensagem de erro do limite, em português, no mesmo tom direto do resto do produto: "Você atingiu o limite de X ofertas ativas do seu plano. Desative uma oferta ou assine um plano maior pra criar mais." — o X é o valor real de `maxOffersPerMonth` do plano da loja.

---

## 1. Limite de ofertas — `src/actions/offer-actions.ts`

`requireMerchantBusiness()` (compartilhada por ofertas, cupons, cardápio e pedidos) passa a incluir o plano na consulta:

```typescript
const business = await prisma.business.findFirst({
  where: { ownerId: session.user.id as string },
  include: { owner: { select: { blocked: true } }, plan: true },
})
```

Isso deixa `business.plan.maxOffersPerMonth` disponível em toda ação de comerciante sem consulta extra. `business.plan` pode ser `null` em teoria (campo `planId` é opcional no schema) — nesse caso o limite não é aplicado (loja sem plano associado não deveria existir na prática, já que o cadastro sempre atribui o plano Grátis, mas a checagem não deve quebrar se acontecer).

Em `createOffer`, logo depois da validação do `parsed`/`computed` e antes do `prisma.offer.create`:

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

`updateOffer`/`cancelOffer` não mudam — editar uma oferta existente não aumenta a contagem de ativas, e cancelar reduz.

## 2. Preferência de plano na Home — `src/lib/offers.ts`

`getFeaturedOffers` já busca `include: { business: true }` — passa a incluir o plano da loja também:

```typescript
const rows = await prisma.offer.findMany({
  where: { /* inalterado */ },
  orderBy: { createdAt: 'desc' },
  include: { business: { include: { plan: true } } },
})
```

Hoje a função ordena por distância só quando há localização (`if (input.location) { items.sort(...) }`), e depende da ordem do banco (`createdAt: 'desc'`) como base quando não há. A nova ordenação por plano precisa ser critério primário em ambos os casos, com distância (quando houver) ou a ordem já vinda do banco como desempate — um único `sort`, não dois separados (dois `sort()` em sequência não compõem: o segundo destrói a ordem que o primeiro estabeleceu, exceto entre itens empatados nele):

```typescript
const ratings = await getRatingsForBusinesses(Array.from(new Set(rows.map((row) => row.business.id))))
const items = rows.map((row) => toOfferListItem(row, row.business, input.location, ratings.get(row.business.id) ?? null))

const priceCentsByOfferId = new Map(rows.map((row) => [row.id, row.business.plan?.priceCents ?? 0]))

items.sort((a, b) => {
  const planDiff = (priceCentsByOfferId.get(b.id) ?? 0) - (priceCentsByOfferId.get(a.id) ?? 0)
  if (planDiff !== 0) return planDiff
  if (input.location) return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  return 0 // mantém a ordem de createdAt desc que já veio do banco
})

return items.slice(0, input.limit)
```

Isso substitui o bloco `if (input.location) { items.sort(...) }` existente por esse único `sort` incondicional. `getOffersList` não é tocada.

## Testes

- `src/actions/__tests__/offer-actions.test.ts`: `createOffer` — rejeita quando `activeCount >= maxOffersPerMonth` com a mensagem exata (interpolando o número certo); permite criar quando abaixo do limite; permite criar quando `business.plan` é `null` (sem checagem). Mock de `prisma.offer.count` precisa ser adicionado ao `vi.mock('@/lib/db', ...)` do arquivo, se ainda não existir.
- `src/lib/__tests__/offers.test.ts`: `getFeaturedOffers` — dado ofertas de lojas com planos de preços diferentes na mesma consulta, retorna ordenado por preço do plano decrescente; dentro do mesmo preço de plano, usa distância como desempate quando há localização; loja sem plano (`plan: null`) é tratada como preço 0 (fica por último). Mock de `prisma.offer.findMany` precisa retornar `business.plan` nos fixtures.

## Erros e casos de borda

- Loja sem `planId`/`plan` (não deveria acontecer, cadastro sempre atribui Grátis, mas o código não quebra): tratada como prioridade mínima (0) na Home, e sem limite de ofertas aplicado.
- Duas lojas no mesmo plano (mesmo `priceCents`): mantém o desempate por distância/data de hoje, sem mudança de comportamento entre elas.
- `maxOffersPerMonth` do plano Grátis é 3 (já seedado) — comerciantes gratuitos continuam podendo operar normalmente, só ficam limitados a 3 ofertas simultâneas, consistente com o texto que já existe no seed.
