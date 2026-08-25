# Cupons (gerar/validar) — design

## Contexto

Este documento cobre o próximo sub-projeto do Aki Ofertas: o fluxo de cupons, previsto desde o design original do MVP (`2026-08-21-aki-ofertas-mvp-design.md`) mas nunca implementado — o schema (`Coupon`, `CouponStatus`) e o gerador de código (`src/lib/coupon-code.ts`) já existem, faltando toda a lógica de negócio e as telas.

Cupons é pré-requisito dos dois sub-projetos seguintes (API mobile e app React Native), que vão expor/consumir este mesmo fluxo — por isso entra primeiro.

Fora de escopo aqui: notificação push quando o cupom está perto de expirar, QR code (fica para uma iteração futura se a validação manual não for suficiente), reserva/estoque compartilhado entre múltiplas ofertas relâmpago simultâneas de uma mesma loja (não existe hoje, não é este documento que introduz).

## Decisões de produto

- **1 cupom por oferta por pessoa.** Depois de gerado, o consumidor só pode visualizar o cupom existente, não gerar outro para a mesma oferta.
- **`quantityAvailable` passa a ser reforçado.** Hoje é só informativo; a partir deste sub-projeto, gerar um cupom consome uma unidade, e a oferta esgota quando `cupons gerados == quantityAvailable`. Ofertas com `quantityAvailable = null` continuam ilimitadas.
- **Validação por código digitado**, não QR code — o comerciante digita o código que o cliente mostra (tela do celular ou impresso).
- **Expiração do cupom = data final da oferta** (`expiresAt = offer.endDate`). Não há um prazo de validade distinto por cupom.
- **Sem job agendado.** Cupom expirado é detectado na hora da validação (`expiresAt < now`), não por uma rotina que atualiza `status` para `EXPIRED` em background — evita introduzir infraestrutura de cron que o projeto não tem hoje. Um cupom com `expiresAt` vencido mas `status` ainda `GENERATED` no banco é tratado como expirado sempre que lido.

## Arquitetura

Segue exatamente o padrão já estabelecido nos sub-projetos anteriores — nenhuma peça nova de infraestrutura:

- **Leitura**: nova função em `src/lib/coupons.ts` (`getCouponsForUser(userId)`) seguindo o padrão de `src/lib/offers.ts`/`src/lib/admin.ts`.
- **Escrita**: novo arquivo `src/actions/coupon-actions.ts` com duas Server Actions (`'use server'`), mesmo formato de retorno `{ok:true,...} | {ok:false,error:string}` usado em todo o projeto.
- **UI**: um botão na página existente `/oferta/[slug]`, uma página nova `/cupons` (consumidor) e uma seção nova dentro do painel do comerciante.

## Fluxo do consumidor

1. Em `/oferta/[slug]`, abaixo dos dados da oferta, um botão condicional:
   - Não logado → botão leva para `/entrar?callbackUrl=/oferta/[slug]` (mesmo padrão de redirect já usado no projeto).
   - Logado, sem cupom gerado, oferta com vaga → **"Gerar cupom"**.
   - Logado, cupom já gerado → **"Ver meu cupom"**, mostra o código direto na página (sem precisar ir para `/cupons`).
   - Oferta esgotada (`quantityAvailable` definido e todas as unidades já geradas) → botão desabilitado, texto **"Esgotado"**.
2. `generateCoupon(offerId: string)`:
   - Confirma sessão ativa (`auth()`); sem sessão → erro genérico "Não autorizado." (a UI não deveria deixar chegar aqui, mas a action defende de qualquer forma).
   - Busca a oferta; não existe ou não está `ACTIVE` → "Oferta não encontrada."
   - Já existe cupom deste usuário para esta oferta → retorna o cupom existente (`{ok:true, coupon}`) em vez de erro — idempotente, evita mensagem de erro confusa se o usuário clicar duas vezes.
   - Dentro de uma `prisma.$transaction`: conta cupons existentes da oferta (`prisma.coupon.count({where:{offerId}})`); se `offer.quantityAvailable !== null && count >= offer.quantityAvailable` → "Esta oferta esgotou." A contagem e a criação do cupom acontecem na mesma transação para não permitir corrida (dois cliques simultâneos gerando cupom além do limite).
   - Cria o `Coupon`: `code: generateCouponCode()` (o campo é `@unique` no schema; se a criação falhar por colisão de código — improvável dado o espaço de 36^6, mas possível — tenta gerar um novo código e recriar até 3 vezes; se todas falharem, retorna "Não foi possível gerar o cupom. Tente novamente."), `status: 'GENERATED'`, `expiresAt: offer.endDate`.
3. `/cupons` (nova página, autenticada, papel CONSUMER): lista os cupons do usuário via `getCouponsForUser`, mais recentes primeiro — código, nome da oferta, nome da loja, status (calculado: `USED` → "Utilizado", `expiresAt < now` → "Expirado", senão "Válido"), data de validade.

## Fluxo do comerciante

1. Nova seção no painel: `/comerciante/cupons` — campo de texto para digitar o código + botão "Validar".
2. `validateCoupon(code: string)`:
   - Confirma sessão MERCHANT e busca a empresa do usuário logado (mesmo padrão de `requireMerchantBusiness()` já usado em `offer-actions.ts` — vamos reaproveisar/exportar essa função em vez de duplicá-la).
   - Busca o cupom pelo código; não existe → "Cupom não encontrado."
   - `coupon.businessId !== business.id` → "Este cupom não é de uma oferta da sua loja." (mensagem específica — evita um comerciante descobrir por tentativa e erro que o código existe mas é de outra loja).
   - `coupon.status === 'USED'` → "Este cupom já foi utilizado."
   - `coupon.expiresAt < now` → "Este cupom está expirado."
   - Senão: `prisma.coupon.update({status:'USED', usedAt: now()})`, retorna `{ok:true, coupon: {..., offerTitle, customerName}}` para a tela mostrar a confirmação (nome da oferta e primeiro nome do cliente, sem expor e-mail/telefone).

## Erros tratados (resumo)

| Situação | Mensagem |
|---|---|
| Não logado tentando gerar | Não autorizado. |
| Oferta inexistente/inativa | Oferta não encontrada. |
| Oferta esgotada | Esta oferta esgotou. |
| Cupom já existe (gerar de novo) | (não é erro — retorna o cupom existente) |
| Código de validação inexistente | Cupom não encontrado. |
| Cupom de outra loja | Este cupom não é de uma oferta da sua loja. |
| Cupom já usado | Este cupom já foi utilizado. |
| Cupom expirado | Este cupom está expirado. |

## Testes

- `src/lib/__tests__/coupons.test.ts`: `getCouponsForUser` (lista vazia, lista com cupons, ordenação).
- `src/actions/__tests__/coupon-actions.test.ts`:
  - `generateCoupon`: sucesso; idempotência (clicar duas vezes); oferta esgotada; oferta inexistente/inativa; sem sessão.
  - Teste de corrida do estoque: mock simulando `count` retornando um valor já igual a `quantityAvailable` dentro da transação, confirmando que o segundo clique é bloqueado.
  - `validateCoupon`: sucesso; código inexistente; cupom de outra loja; já usado; expirado; sem sessão MERCHANT.

## Interfaces que o próximo sub-projeto (API mobile) vai consumir

- `generateCoupon(offerId)` e `getCouponsForUser(userId)` — a API mobile chama essas mesmas funções por trás de um endpoint JSON, não duplica a lógica.
- `validateCoupon(code)` fica só no painel web do comerciante (fora do escopo do app mobile, que é só para o consumidor).
