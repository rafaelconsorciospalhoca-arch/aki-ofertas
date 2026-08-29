# Histórico de Cupons e Relatórios do Comerciante — Design

## Objetivo

O comerciante hoje não tem nenhuma visão histórica dos cupons gerados/usados
para suas ofertas — só consegue validar um cupom individual (digitando ou
escaneando o código) em `/comerciante/cupons/validar`. Este projeto adiciona
uma aba "Relatórios" no painel com o histórico completo de cupons e um
resumo agregado por oferta (gerados x usados), para o comerciante acompanhar
o desempenho das promoções.

Escopo: só o lado comerciante (`src/app/comerciante/...`). Não altera o
fluxo de geração/validação de cupom em si, nem o app mobile.

## Dados

Duas novas funções em `src/lib/coupons.ts`:

```ts
export type MerchantCouponRow = CouponRow & { customerName: string }

export async function getCouponsForBusiness(businessId: string): Promise<MerchantCouponRow[]>
```
Mesma query/mapeamento de `getCouponsForUser`, trocando o filtro para
`businessId` e incluindo `user: { select: { name: true } }` para preencher
`customerName`. Ordenado por `generatedAt: 'desc'`.

```ts
export type OfferCouponStats = {
  offerId: string
  offerTitle: string
  generated: number
  used: number
}

export async function getCouponStatsForBusiness(businessId: string): Promise<OfferCouponStats[]>
```
Implementado com `prisma.coupon.groupBy({ by: ['offerId', 'status'], where: { businessId }, _count: true })`,
depois reagrupado em memória por `offerId` (somando todos os status em
`generated`, e apenas `status: 'USED'` em `used`), com o título da oferta
resolvido via uma segunda query simples (`prisma.offer.findMany` pelos
`offerId`s encontrados) ou um `include` equivalente. Ordenado por
`generated` decrescente (ofertas com mais cupons gerados aparecem primeiro).

Sem paginação nem filtro de data nesta primeira versão — mesma escolha já
feita em `OrderManager`/`MenuManager` (listas simples, sem paginação), e o
volume esperado (comércio hiperlocal, poucas ofertas) não justifica a
complexidade agora.

## Painel do comerciante

Nova rota `/comerciante/relatorios`, novo item "Relatórios" no menu lateral
(`DashboardShell`), logo depois de "Pedidos". Disponível para todo
comerciante, sem trava de plano (o campo `hasFullMetrics` existente no
`Plan` fica sem uso nesta feature — decisão explícita, não pendência).

A página (`src/app/comerciante/relatorios/page.tsx` + componente
`src/components/merchant/ReportsView.tsx`) tem duas seções, mesmo padrão
visual de tabela das páginas existentes (`OrderManager`, `MenuManager`):

1. **Resumo por oferta** (topo): tabela com Oferta, Gerados, Usados, Taxa de
   conversão (`used/generated`, formatada como `%`, ou "—" quando
   `generated === 0`).
2. **Histórico de cupons** (abaixo): tabela com Código, Oferta, Cliente,
   Status (badge colorido, reaproveitando o padrão de cores já usado em
   `ValidateCouponForm`/`OrderManager` para status), Gerado em, Usado em
   (ou "—" se nunca usado).

Sem nenhum cupom ainda: mensagem "Nenhum cupom gerado ainda." em vez das
tabelas (mesmo padrão de `MenuManager`/`OrderManager` para listas vazias).

## Erros e casos de borda

- Comerciante sem nenhuma oferta: ambas as seções mostram a mensagem de
  vazio, sem erro.
- Cupom de uma oferta já excluída (não deveria acontecer, `Offer` nunca é
  deletado no sistema hoje) — fora de escopo, não tratado especialmente.

## Testes

- `src/lib/__tests__/coupons.test.ts` (arquivo já existe): novos casos para
  `getCouponsForBusiness` (escopo por `businessId`, mapeamento de
  `customerName`) e `getCouponStatsForBusiness` (agregação correta de
  gerados/usados por oferta, ofertas sem cupom nenhum não aparecem na
  lista).
- Nenhuma mudança em `server actions`/API — não há novos testes de rota.
