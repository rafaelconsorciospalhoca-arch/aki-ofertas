# Aki Ofertas — MVP design

## Contexto

Aki Ofertas é uma plataforma de descoberta de comércio local: consumidores encontram ofertas, produtos e serviços de estabelecimentos próximos usando geolocalização; comerciantes publicam ofertas e cupons; um admin aprova e supervisiona tudo. O briefing completo do produto (43 seções) cobre uma visão de longo prazo — IA para gerar ofertas, impulsionamento pago, pagamentos reais, banners, avaliações, app nativo. Este documento cobre **apenas o sub-projeto 1: o MVP**, definido junto com o usuário como o recorte da seção 40 do briefing original.

Fora de escopo neste documento (fase 2+): IA para criar ofertas, impulsionamento pago, gateway de pagamento real (PIX/cartão), banners administráveis, avaliações de estabelecimentos, mapa interativo, apps nativos iOS/Android, múltiplas unidades por comerciante, notificações push reais, busca com IA.

## Decisões de produto

- **Consumidor**: experiência mobile-first via navegador (preparada para virar PWA/app nativo depois). Nunca paga para usar o app.
- **Comerciante e admin**: acessam pelo navegador, no computador ou no celular (não é um app nativo separado — é responsivo).
- **Monetização**: assinatura de planos do comerciante (Grátis/Pro/Destaque) — estrutura de dados pronta, mas sem gateway de pagamento real no MVP (assinatura fica com status manual/simulado).

## Arquitetura

Um único app **Next.js 14 (App Router) + TypeScript**, com três áreas de rota protegidas por papel:

- `/` … rotas do consumidor (público + autenticado)
- `/comerciante/**` … painel do comerciante (autenticado, role MERCHANT)
- `/admin/**` … painel administrativo (autenticado, role ADMIN)

Um único banco de dados PostgreSQL serve as três áreas — não há necessidade de apps ou bancos separados no MVP; a separação é por rota + middleware de autorização.

**Stack:**
- Next.js 14 App Router + TypeScript
- Tailwind CSS + componentes reutilizáveis próprios (sem biblioteca de UI pesada)
- PostgreSQL hospedado no Neon
- Prisma como ORM
- Auth.js (NextAuth) com provider de credenciais (email/senha, hash bcrypt), sessão JWT carregando `role`
- Upload de imagens (logo, capa, foto de oferta): Vercel Blob
- Deploy: Vercel (app), Neon (banco)
- Geolocalização: Geolocation API do navegador no client; distância calculada no servidor com fórmula de Haversine sobre colunas `lat`/`lng` (sem PostGIS no MVP — volume baixo o suficiente para filtrar em SQL puro)

**Por que essa combinação:** é a stack que o próprio briefing pede (seção 36), roda inteira na Vercel com um único deploy (mais simples de manter que 3 apps separados), e o usuário já tem familiaridade com Vercel (usado no FoodZap CRM).

## Modelo de dados (MVP)

Entidades essenciais — nomes de tabela em `snake_case` via Prisma `@@map`:

- **User**: id, name, email (unique), phone, passwordHash, role (`CONSUMER`|`MERCHANT`|`ADMIN`), city, state, createdAt
- **City**: id, name, state, active, comingSoon
- **Category**: id, name, icon, order, active
- **Business**: id, ownerId→User, name, legalName, document (CNPJ/CPF), categoryId→Category, phone, whatsapp, email, instagram, website, address, number, neighborhood, city, state, zip, lat, lng, description, logoUrl, coverUrl, status (`PENDING`|`ACTIVE`|`SUSPENDED`|`REJECTED`), planId→Plan, createdAt
- **BusinessHours**: id, businessId→Business, weekday (0-6), opensAt, closesAt, closed (bool)
- **Offer**: id, businessId→Business, title, description, imageUrl, originalPrice, discountPrice, discountPercent (calculado), categoryId→Category, quantityAvailable (nullable), startDate, endDate, isFlash (bool), status (`DRAFT`|`ACTIVE`|`EXPIRED`|`CANCELLED`), createdAt
- **Coupon**: id, code (unique, formato `AK` + random), userId→User, offerId→Offer, businessId→Business, status (`GENERATED`|`USED`|`EXPIRED`|`CANCELLED`), generatedAt, usedAt, expiresAt
- **Favorite**: id, userId→User, businessId→Business (nullable), offerId→Offer (nullable), createdAt
- **Plan**: id, name, priceCents, maxOffersPerMonth, hasFlashOffers (bool), hasFullMetrics (bool), features (json)
- **Subscription**: id, businessId→Business, planId→Plan, status (`ACTIVE`|`CANCELLED`|`PAST_DUE`), startedAt, renewsAt — estrutura pronta para fase 2 conectar gateway real
- **AnalyticsEvent**: id, businessId→Business, offerId (nullable), type (`VIEW`|`WHATSAPP_CLICK`|`ROUTE_CLICK`|`FAVORITE`), createdAt — base simples para as métricas do painel do comerciante e admin

Reviews, banners, múltiplas unidades por empresa, IA e impulsionamento ficam fora do schema do MVP (evita migração especulativa — entram quando a fase 2 for desenhada).

## Fluxo principal (precisa funcionar de ponta a ponta)

1. **Comerciante**: cadastro → cadastra empresa (status `PENDING`) → aguarda aprovação.
2. **Admin**: aprova a empresa (status → `ACTIVE`).
3. **Comerciante**: cria oferta (`ACTIVE`).
4. **Consumidor**: cadastro → permite localização (ou escolhe cidade manualmente) → vê ofertas próximas ordenadas por distância → abre oferta → gera cupom (`GENERATED`).
5. **Consumidor**: vai ao estabelecimento, mostra o código do cupom.
6. **Comerciante**: valida cupom por código → marca como utilizado (`USED`) → evento de analytics gravado.
7. **Admin**: acompanha tudo via dashboard (usuários, empresas, ofertas, cupons gerados/utilizados).

## Páginas (MVP)

**Consumidor** (`/`)
- `/` — home (categorias + ofertas em destaque, ordenadas por distância)
- `/entrar`, `/cadastro` — auth
- `/onboarding` — permissão de localização / seleção manual de cidade
- `/ofertas` — lista com filtros (categoria, raio de distância)
- `/oferta/[slug]` — detalhe da oferta + gerar cupom
- `/loja/[slug]` — página do estabelecimento (abas Sobre/Ofertas)
- `/cupons` — meus cupons (auth)
- `/favoritos` — favoritos (auth)
- `/perfil` — dados da conta (auth)

**Comerciante** (`/comerciante`)
- `/comerciante/entrar`, `/comerciante/cadastro` — auth + cadastro da empresa
- `/comerciante` — dashboard (métricas, ofertas ativas)
- `/comerciante/ofertas`, `/comerciante/ofertas/nova`, `/comerciante/ofertas/[id]` — CRUD de ofertas
- `/comerciante/cupons/validar` — validar cupom por código
- `/comerciante/empresa` — editar perfil da empresa
- `/comerciante/plano` — visualizar/trocar plano (sem cobrança real)

**Admin** (`/admin`)
- `/admin/entrar`
- `/admin` — dashboard geral
- `/admin/usuarios` — buscar/bloquear/desbloquear
- `/admin/empresas` — aprovar/reprovar/bloquear/destacar
- `/admin/categorias` — CRUD de categorias
- `/admin/cidades` — CRUD de cidades (ativa/em breve)
- `/admin/planos` — editar preços e limites dos planos

## Componentes reutilizáveis

`OfferCard`, `BusinessCard`, `CategoryGrid`, `CouponBadge`, `DistanceFilter`, `StatusPill`, `StatCard`, `DataTable` (usado nos três painéis admin/comerciante), `AppShell` (layout com bottom-nav no consumidor, sidebar nos painéis), `LocationGate` (onboarding de permissão).

## Segurança

- Senhas com bcrypt, nunca em texto plano.
- Middleware do Next.js valida `role` da sessão antes de liberar `/comerciante/**` e `/admin/**`.
- Toda mutação (Server Action) revalida a sessão e o papel no servidor — nunca confia em checagem apenas no client.
- Validação de input com Zod em todos os formulários e Server Actions.
- Rate limiting básico nas rotas de auth e de validação de cupom (evita força bruta de código).
- `.env.example` documentando todas as variáveis; nenhum secret hardcoded.

## Dados de demonstração (seed)

Cidades: Marmeleiro, Francisco Beltrão, Pato Branco (ativas), Curitiba, Cascavel (em breve). Empresas fictícias: Big Burger, Pizzaria do Chef, Barbearia VIP, Cantinho do Café, Pizzaria House — cada uma com 1-2 ofertas ativas, para o fluxo completo já nascer demonstrável.

## Ordem de implementação sugerida

1. Setup do projeto (Next.js, Tailwind, Prisma, Neon, Auth.js) + schema + seed
2. Layout global (AppShell consumidor + shells de comerciante/admin) + auth (3 papéis)
3. Consumidor: home, categorias, lista de ofertas, geolocalização/distância
4. Comerciante: cadastro de empresa, CRUD de ofertas
5. Admin: aprovação de empresas, categorias, cidades
6. Cupons: gerar (consumidor) + validar (comerciante) + status
7. Planos: estrutura de dados + tela de seleção (sem cobrança real)
8. Métricas básicas (AnalyticsEvent) nos dashboards de comerciante e admin
9. Validação do fluxo ponta a ponta com dados de seed

Cada etapa preserva o que já funciona da etapa anterior — sem reescrever módulos inteiros ao avançar.
