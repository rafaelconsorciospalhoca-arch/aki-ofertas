# Sobrescrita de Comissão por Comerciante — Design

## Objetivo

Hoje a comissão de entrega é definida só por categoria (`Category.commissionPercent`)
— todo negócio da categoria entra no mesmo modelo, sem exceção. Este projeto dá
ao admin uma forma de sobrescrever isso caso a caso: forçar um percentual
diferente pra um comerciante específico, ou tirar um comerciante do modelo de
comissão mesmo estando numa categoria que cobra (fazendo ele voltar pra
mensalidade).

## 1. Modelo de dados

`Business` ganha dois campos:
```prisma
  commissionOverrideEnabled Boolean @default(false)
  commissionOverridePercent Int?
```
- `commissionOverrideEnabled: false` (padrão) → vale o percentual da
  categoria, sem mudança nenhuma no comportamento atual.
- `commissionOverrideEnabled: true, commissionOverridePercent: null` → força
  **sem comissão** pra esse negócio (mensalidade normal), mesmo que a
  categoria dele cobre.
- `commissionOverrideEnabled: true, commissionOverridePercent: N` → força
  comissão de `N`%, seja qual for o percentual (ou ausência de percentual)
  da categoria.

## 2. Função central `getEffectiveCommissionPercent`

Nova função em `src/lib/commission.ts`:
```ts
export function getEffectiveCommissionPercent(business: {
  commissionOverrideEnabled: boolean
  commissionOverridePercent: number | null
  category: { commissionPercent: number | null }
}): number | null {
  if (business.commissionOverrideEnabled) return business.commissionOverridePercent
  return business.category.commissionPercent
}
```

Todos os pontos que hoje leem `business.category.commissionPercent`
diretamente passam a usar essa função — é a única fonte de verdade sobre "esse
negócio cobra comissão ou não, e quanto":

- `src/lib/weekly-commission.ts` (`generateWeeklyCommissionInvoices`) — a
  query que hoje filtra `category: { commissionPercent: { not: null } }`
  direto no banco passa a buscar todo negócio `ACTIVE` (com `category`
  incluída) e filtrar em memória com `getEffectiveCommissionPercent`, já que
  a combinação categoria+override não dá pra expressar de forma simples só
  no `where` do Prisma.
- `src/lib/billing.ts` (`suspendForPayment`) — mesma troca: em vez de
  `business.category.commissionPercent !== null`, usa
  `getEffectiveCommissionPercent(business) !== null`.
- `src/app/api/cron/expire-trials/route.ts` — mesma troca: busca sem o
  filtro `category: { commissionPercent: null }` no `where`, inclui
  `category`, e filtra os candidatos a suspender em memória excluindo quem
  tem `getEffectiveCommissionPercent(business) !== null`.
- `src/actions/merchant-actions.ts` (`subscribeToPlan`) — mesma troca.
- `src/app/comerciante/plano/page.tsx` — mesma troca pra decidir entre
  `CommissionPanel`/`PlanoForm`.

## 3. Admin — nova página de detalhe da empresa

Hoje `/admin/empresas` só lista e tem ações inline (aprovar/suspender/etc,
via `BusinessStatusActions`) — não existe página de detalhe. Nova rota
`/admin/empresas/[id]`, acessível a partir de um link no nome da empresa na
listagem.

Seção "Comissão de entrega": três opções (radio/select) —
- "Usar padrão da categoria" (`commissionOverrideEnabled: false`)
- "Forçar comissão de ___%" (`commissionOverrideEnabled: true`,
  `commissionOverridePercent: N`)
- "Forçar mensalidade (sem comissão)" (`commissionOverrideEnabled: true`,
  `commissionOverridePercent: null`)

Nova server action `updateBusinessCommissionOverride(businessId, input)` em
`src/actions/admin-actions.ts`, mesmo padrão de autorização
(`requireAdmin()`) e validação (percentual inteiro 0–100 quando "forçar
comissão" é escolhido) já usado em `updateCategory`.

## Erros e casos de borda

- Mudar o override de um negócio não altera faturas de comissão já geradas
  (mesmo princípio de snapshot já usado em todo o resto da feature).
- Override pra "forçar mensalidade" num negócio que já está isento (porque
  a categoria dele cobra comissão) faz ele passar a precisar assinar um
  plano normalmente na próxima vez que for tela de `/comerciante/plano` —
  comportamento já existente pra quem nunca teve comissão, sem mudança
  nova.

## Testes

- `src/lib/__tests__/commission.test.ts` (novo): casos pra
  `getEffectiveCommissionPercent` — override desligado usa categoria,
  override ligado com percentual usa o percentual, override ligado sem
  percentual força `null` mesmo com categoria tendo comissão.
- Testes já existentes de `weekly-commission.ts`, `billing.ts`,
  `expire-trials`, `merchant-actions.ts`, `comerciante/plano` (indireto,
  via build) — ajustados pra incluir os dois novos campos nos fixtures de
  `business`, mantendo o comportamento atual quando `commissionOverrideEnabled: false`.
- `src/actions/__tests__/admin-actions.test.ts`: novos casos pra
  `updateBusinessCommissionOverride` (não autorizado, percentual inválido,
  cada uma das três combinações salvando os campos certos).
