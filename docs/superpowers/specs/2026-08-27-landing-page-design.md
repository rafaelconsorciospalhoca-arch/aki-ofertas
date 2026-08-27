# Landing Page de Marketing — Design

> **For agentic workers:** implement inline in this session (small, single-page scope) or via superpowers:executing-plans if resumed elsewhere.

**Goal:** Dar ao Aki Ofertas uma página institucional para visitantes novos (principalmente vindos do Google/desktop), explicando a proposta pro consumidor e convidando comerciantes a se cadastrar — sem alterar a experiência de quem já usa o app.

**Architecture:** Nova página server component em `src/app/(consumer)/page.tsx` que decide, no servidor, entre renderizar a landing ou a home de ofertas atual, com base nos mesmos cookies de localização/cidade já usados hoje. A landing ganha um layout próprio (fora do `ConsumerShell` mobile-only), responsivo para desktop.

**Tech Stack:** Next.js 14 (App Router, server components), Tailwind CSS, Prisma (leitura de categorias/cidades reais).

## Global Constraints

- Não alterar o comportamento para visitantes que já têm cookie de localização (`GEO_COOKIE`) ou de cidade (`CITY_COOKIE`) — eles continuam vendo a home de ofertas exatamente como hoje.
- A landing não introduz nenhuma cobrança real nem lógica de limite de ofertas por plano — é conteúdo informacional apenas. Os 3 cards de plano são estáticos (hardcoded no componente), não vêm da tabela `Plan` (que já existe no schema mas está desconectada de qualquer enforcement — não deve ser tocada neste trabalho).
- Cores/marca: reaproveitar exatamente as classes já usadas no app (`bg-brand-navy`, `bg-brand-green`, `text-brand-green-light`, etc.) — não introduzir uma paleta nova.
- Todo o texto em português, no mesmo tom direto já usado no resto do produto.
- O resto do app (rotas do comerciante, admin, cupons, etc.) continua mobile-only, sem alterações de layout.

---

## Componentes e fluxo de dados

### 1. Detecção de visitante novo (`src/app/(consumer)/page.tsx`)

A página já lê `GEO_COOKIE`/`CITY_COOKIE` hoje. Regra nova: se `!location && !city`, renderiza `<LandingPage categories={...} cities={...} />` em vez do conteúdo atual de ofertas. Caso contrário, comportamento inalterado (a lógica de ofertas existente continua exatamente igual, dentro de um `else`).

### 2. `LandingPage` (`src/components/landing/LandingPage.tsx`)

Server component. Recebe como props:
- `categories: { id: string; name: string; icon: string }[]` — de `getActiveCategories()` (já existe em `src/lib/categories.ts`)
- `cities: { id: string; name: string; state: string }[]` — de uma nova função `getCitiesWithActiveBusinesses()` (ver seção 5)

Renderiza, nesta ordem: `LandingHeader`, `Hero`, `HowItWorks`, `CategoriesShowcase`, `CitiesShowcase`, `MerchantSection` (com `Benefits` + `PricingCards`), `LandingFooter`. Cada seção é um componente próprio dentro de `src/components/landing/`, arquivos pequenos e focados (padrão já usado no resto do projeto: um componente por arquivo).

### 3. Layout responsivo

A landing não usa `ConsumerShell`. Envolve tudo num wrapper com `max-w-6xl mx-auto` para o conteúdo, `LandingHeader` fixo no topo (logo + link "Entrar" para `/entrar`) e `LandingFooter` no final (links para "Cadastrar minha loja" e "Entrar"). Seções que hoje seriam uma coluna única (categorias, cidades, planos) usam grid do Tailwind que colapsa pra 1 coluna em mobile e expande em `md:`/`lg:` (ex: `grid-cols-2 md:grid-cols-4` pras categorias, `grid-cols-1 md:grid-cols-3` pros planos).

### 4. Conteúdo de cada seção

**Hero** — título (`Ofertas boas, pertinho de você`), subtítulo curto explicando a proposta, botão primário "Ver ofertas perto de mim" → `/onboarding`.

**HowItWorks** — 3 passos numerados: (1) Ative sua localização, (2) Veja ofertas de lojas perto de você, (3) Resgate o cupom direto na loja. Cada passo com ícone simples (reaproveitar estilo de ícone SVG inline já usado no header da home atual).

**CategoriesShowcase** — grid com as categorias reais (`categories` prop), cada uma um link estático para `/ofertas` (a listagem geral — não há filtro por categoria na URL ainda, então não inventamos um). Mostra o ícone (campo `icon`, já é uma string emoji/glyph usada hoje no `CategoryGrid`) e o nome.

**CitiesShowcase** — lista as cidades reais (`cities` prop) como chips/badges simples (`{name} - {state}`). Se `cities` vier vazio (banco sem nenhuma cidade com negócio ativo ainda), a seção inteira não renderiza (sem estado vazio feio).

**MerchantSection** — subtítulo de transição ("Tem uma loja ou restaurante?"), `Benefits` (lista de 3-4 bullets: "Alcance clientes perto da sua loja", "Painel de pedidos e cupons", "Cadastro rápido, sem burocracia"), botão "Cadastrar minha loja" → `/comerciante/cadastro`, e `PricingCards`.

**PricingCards** — 3 cards estáticos, cada um com nome, preço, lista de benefícios, e a etiqueta "Em breve — cadastro grátis por enquanto" no topo dos 3 (não em cada um individualmente, pra não repetir):
  - **Básico** — R$ 49,90/mês — até 5 ofertas ativas
  - **Destaque** — R$ 99,90/mês — aparece também na página inicial + mais ofertas ativas
  - **Turbo** — R$ 199,90/mês — destaque no card grande da página inicial

(Os nomes "Básico"/"Destaque"/"Turbo" são só o rótulo de exibição da landing — não escrevem nem leem a tabela `Plan` do banco.)

### 5. Nova função de dados: `getCitiesWithActiveBusinesses`

Adicionar em `src/lib/categories.ts`, ao lado de `getActiveCities`:

```typescript
export async function getCitiesWithActiveBusinesses() {
  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE' },
    select: { city: true, state: true },
    distinct: ['city', 'state'],
  })
  return businesses
    .map((b) => ({ name: b.city, state: b.state }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
```

Motivo de não reaproveitar `getActiveCities()`: aquela função lê a tabela `City` (usada para o formulário de cadastro/onboarding), que pode ter cidades cadastradas como `active: true` mas ainda sem nenhum negócio de verdade (inclusive tem a flag `comingSoon` pra isso). A landing quer mostrar cobertura real, então busca direto pelas cidades que aparecem em negócios `ACTIVE`.

## Testes

- `src/lib/__tests__/categories.test.ts` (existente ou novo): teste para `getCitiesWithActiveBusinesses` — mocka `prisma.business.findMany` e verifica que retorna nomes únicos ordenados alfabeticamente, mapeados para `{name, state}`.
- Sem testes de snapshot/render para os componentes de landing (o projeto não usa testing-library para componentes React do site — os testes existentes cobrem `src/lib/*`, não JSX). Verificação visual via Browser tool antes de concluir.

## Erros e casos de borda

- `cities` vazio → `CitiesShowcase` não renderiza nada (retorna `null`).
- `categories` vazio (extremamente improvável, mas por segurança) → `CategoriesShowcase` não renderiza nada.
- Nenhum estado de erro novo: as duas queries (`getActiveCategories`, `getCitiesWithActiveBusinesses`) já seguem o padrão de outras chamadas Prisma no projeto (sem try/catch — erros de banco propagam pro error boundary padrão do Next, igual ao resto do app).
