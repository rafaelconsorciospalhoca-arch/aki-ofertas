# Sabores, Bordas e Adicionais nas Ofertas — Design

## Objetivo

Deixar o comerciante configurar opções de personalização por oferta —
sabores e bordas de pizza (escolha única), adicionais em outros lanches
(múltipla escolha) — genéricas o bastante pra servir qualquer combinação,
não hardcoded por tipo de comida. O cliente escolhe entre essas opções ao
pedir aquela oferta com entrega; a escolha vale pra toda a quantidade
pedida (não por unidade). O preço extra das escolhas soma no total,
multiplicado pela quantidade.

## 1. Modelo de dados

```prisma
enum OfferOptionGroupType {
  SINGLE
  MULTIPLE
}

model OfferOptionGroup {
  id       String               @id @default(cuid())
  offerId  String
  offer    Offer                @relation(fields: [offerId], references: [id], onDelete: Cascade)
  name     String
  type     OfferOptionGroupType @default(SINGLE)
  required Boolean              @default(false)
  order    Int                  @default(0)

  choices  OfferOptionChoice[]

  @@map("offer_option_groups")
}

model OfferOptionChoice {
  id              String           @id @default(cuid())
  groupId         String
  group           OfferOptionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name            String
  extraPriceCents Int              @default(0)
  order           Int              @default(0)

  @@map("offer_option_choices")
}
```

`Offer` ganha `optionGroups OfferOptionGroup[]`.

`Order` ganha dois campos snapshot (mesmo princípio já usado pra
`deliveryFeeCents`/`neighborhood` — não mudam se o comerciante editar as
opções depois):
```prisma
  selectedOptions  String?
  optionsFeeCents  Int?
```
`selectedOptions` é um resumo legível, ex.: `"Sabor: Calabresa · Borda:
Recheada · Adicionais: Bacon, Cheddar"`. `optionsFeeCents` é a soma dos
`extraPriceCents` das escolhas selecionadas, **multiplicada pela
quantidade** do pedido.

## 2. Painel do comerciante — configurar opções

Nova seção "Opções de personalização" na tela de editar oferta
(`/comerciante/ofertas/[id]`, abaixo do `OfferForm` já existente — só
ofertas já criadas podem ter opções, já que o grupo precisa de um
`offerId`). Novo componente `OfferOptionsManager`:

- Lista de grupos já cadastrados, cada um mostrando suas escolhas.
- Formulário pra adicionar grupo: nome, tipo (única/múltipla), obrigatório
  (checkbox).
- Dentro de cada grupo: formulário pra adicionar escolha (nome, preço
  extra em R$, opcional/zero) e lista das escolhas já cadastradas com
  botão de excluir.
- Excluir um grupo remove as escolhas dele em cascata (`onDelete:
  Cascade`).

Novo arquivo `src/actions/offer-option-actions.ts`, mesmo padrão de
autorização (`requireMerchantBusiness()`) já usado no resto do painel —
toda ação (criar/editar/excluir grupo ou escolha) confere que a oferta (via
o grupo, no caso de escolha) pertence ao negócio autenticado antes de
mexer em qualquer coisa.

## 3. Oferta expõe as opções pro cliente

`OfferDetail` (`src/lib/offers.ts`) ganha:
```ts
optionGroups: {
  id: string
  name: string
  type: 'SINGLE' | 'MULTIPLE'
  required: boolean
  choices: { id: string; name: string; extraPriceCents: number }[]
}[]
```
(só grupos/escolhas da oferta, sem filtro de "ativo" — diferente de
`deliveryZones`, aqui não existe conceito de desativar uma opção
temporariamente nesta primeira versão; excluir é a única forma de remover).

## 4. Pedido do cliente

Na tela `pedido/[slug].tsx`, se `offer.optionGroups.length > 0`, mostra
cada grupo antes do resumo de total: rádio (única escolha) ou checkbox
(múltipla) por escolha, com o preço extra ao lado quando não for zero (ex.:
"Bacon (+R$ 3,00)"). Grupo `required` sem nenhuma escolha feita trava o
botão de confirmar (mesmo padrão de `canSubmit` já usado pra bairro
obrigatório).

Ao confirmar, o app manda `selectedChoiceIds: string[]` (lista achatada de
todas as escolhas marcadas, de todos os grupos) junto do resto do payload
do pedido.

## 5. Backend valida e calcula ao criar o pedido

Em `createOrderForUser` (`src/lib/orders.ts`):
1. Pra cada grupo `required` da oferta, pelo menos uma escolha desse grupo
   precisa estar em `selectedChoiceIds` — senão, erro `"Escolha uma opção
   para {nome do grupo}."`.
2. Pra grupo do tipo `SINGLE`, no máximo uma escolha desse grupo pode estar
   selecionada — senão, erro `"Escolha apenas uma opção para {nome do
   grupo}."`.
3. Toda escolha em `selectedChoiceIds` precisa pertencer a algum grupo
   dessa oferta — senão, erro `"Opção inválida."`.
4. `optionsFeeCents = soma(extraPriceCents das escolhas selecionadas) ×
   quantity`.
5. `selectedOptions` = resumo textual (grupo: escolhas separadas por
   vírgula, grupos separados por " · ", na ordem dos grupos).
6. Grava `selectedOptions`/`optionsFeeCents` no `Order` junto do resto.

## 6. Exibição no painel do comerciante e no total do cliente

- `OrderManager`/impressão do pedido (`src/components/merchant/OrderManager.tsx`,
  `src/app/comerciante/pedidos/[id]/imprimir/page.tsx`): nova linha
  "Opções: {order.selectedOptions}" quando não nulo, e o total passa a
  somar `+ (order.optionsFeeCents ?? 0)`.
- App mobile: total exibido na tela de pedido e no histórico
  (`app-mobile/app/pedidos.tsx`) também passam a somar as opções.

## Erros e casos de borda

- Oferta sem nenhum grupo de opção → tela de pedido funciona exatamente
  como hoje, sem nenhuma seção nova visível.
- Comerciante exclui um grupo/escolha depois que já existem pedidos com
  ele selecionado → pedidos antigos preservam o texto/valor já gravados
  (sem FK do `Order` pras tabelas de opção, só o snapshot).
- Cliente manda um `selectedChoiceIds` de uma oferta diferente da que está
  pedindo → cai no erro de "Opção inválida." (passo 3 acima).

## Testes

- `src/actions/__tests__/offer-option-actions.test.ts`: CRUD completo de
  grupo e escolha, isolamento por comerciante (não mexe em oferta de
  outro), cascata ao excluir grupo.
- `src/lib/__tests__/offers.test.ts`: `getOfferBySlug` inclui
  `optionGroups`/`choices` corretamente.
- `src/lib/__tests__/orders.test.ts`: validação dos três casos de erro
  (obrigatório sem escolha, única escolha com mais de uma marcada, escolha
  de fora da oferta), cálculo correto de `optionsFeeCents` multiplicado
  pela quantidade, resumo textual correto, e o caso sem nenhum grupo
  (comportamento inalterado).
