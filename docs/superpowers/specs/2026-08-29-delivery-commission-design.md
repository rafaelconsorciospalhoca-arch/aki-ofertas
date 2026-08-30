# Comissão Semanal sobre Pedidos de Entrega — Design

## Objetivo

Cobrar uma comissão percentual (definida pelo admin, por categoria) sobre o
valor vendido em pedidos com entrega, apurada e cobrada toda segunda-feira
referente à semana anterior. Comerciantes de uma categoria com comissão
ativada ficam isentos da mensalidade do plano — a receita da plataforma
para eles passa a vir só da comissão. Cobrança em atraso bloqueia o
negócio, reaproveitando o mecanismo de suspensão já usado para mensalidade
em atraso.

Não há processamento de pagamento pela plataforma — o cliente continua
pagando o comerciante diretamente. A comissão é calculada sobre os pedidos
já registrados no próprio sistema (não é autodeclarada) e cobrada à parte,
via Asaas (mesma integração já usada para as assinaturas de plano).

## 1. Modelo de dados

`Category` ganha um campo:
```prisma
  commissionPercent Int?
```
`null` (ou ausente) = categoria não cobra comissão. Um valor (ex. `10`) =
todo negócio dessa categoria entra automaticamente no modelo de comissão —
não é uma escolha do comerciante.

Novo modelo:
```prisma
model CommissionInvoice {
  id            String   @id @default(cuid())
  businessId    String
  business      Business @relation(fields: [businessId], references: [id])
  weekStart     DateTime
  weekEnd       DateTime
  salesCents    Int
  percent       Int
  feeCents      Int
  status        String   @default("PENDING") // PENDING | PAID | OVERDUE
  asaasPaymentId String?
  dueDate       DateTime
  paidAt        DateTime?
  createdAt     DateTime @default(now())

  @@unique([businessId, weekStart])
  @@map("commission_invoices")
}
```
`Business` ganha `commissionInvoices CommissionInvoice[]`. O `@@unique`
impede gerar duas cobranças pra mesma semana do mesmo negócio (proteção
contra o cron rodar duas vezes por engano).

`percent` e `feeCents` são um snapshot — se o admin mudar o percentual da
categoria depois, faturas já geradas não mudam de valor retroativamente
(mesmo princípio já usado no snapshot de taxa de entrega por bairro).

## 2. Admin — configurar comissão por categoria

`src/components/admin/CategoryForm.tsx` ganha um campo "Comissão de entrega
(%)" — input numérico opcional, vazio = sem comissão. `categorySchema`
(`src/actions/admin-actions.ts`) ganha `commissionPercent:
z.string().optional()`, convertido pra `Int | null` do mesmo jeito que
`parseOrder` já converte `order` (validar inteiro entre 0 e 100; vazio =
`null`).

## 3. Job semanal de cobrança

Novo cron `src/app/api/cron/weekly-commission/route.ts`, mesmo padrão de
autenticação (`CRON_SECRET`) e formato de resposta de
`src/app/api/cron/expire-trials/route.ts`. Registrado em `vercel.json`:
```json
{ "path": "/api/cron/weekly-commission", "schedule": "0 6 * * 1" }
```
(segunda-feira, 6h UTC — mesmo horário do cron de trial já existente).

Para cada `Business` com `status: 'ACTIVE'` cuja `category.commissionPercent`
não é nulo:
1. Calcula a janela da semana anterior: `weekStart` = segunda-feira anterior
   00:00, `weekEnd` = essa segunda-feira 00:00 (exclusive).
2. Soma `discountPrice × quantity` de todo `Order` desse negócio com
   `createdAt` dentro da janela e `status != 'CANCELLED'` — **sem** somar
   `deliveryFeeCents` (comissão incide só no valor do produto, não na taxa
   de entrega do próprio comerciante, conforme decidido).
3. Se a soma for `0`, não gera cobrança nem fatura pra essa semana.
4. Senão, calcula `feeCents = round(salesCents × percent / 100)`, cria o
   `CommissionInvoice` (`status: 'PENDING'`) e uma cobrança avulsa no Asaas
   via nova função `createAsaasCharge` em `src/lib/asaas.ts` (endpoint
   `/payments`, `billingType: 'UNDEFINED'`, `value: feeCents / 100`,
   `dueDate` = hoje, `externalReference` = `commissionInvoice.id` — **não**
   `business.id`, pra diferenciar de cobranças de assinatura e permitir o
   webhook achar a fatura certa direto). Salva `asaasPaymentId` retornado.
5. Negócio sem `asaasCustomerId` ainda (nunca assinou plano) — cria o
   customer Asaas primeiro (reaproveita `createAsaasCustomer`, mesmos dados
   já usados em `subscribeToPlan`), usando os dados do `owner`.

## 4. Isenção de mensalidade

Em `subscribeToPlan` (`src/actions/merchant-actions.ts`), depois de
resolver `business` e antes de criar a assinatura no Asaas: se
`business.category.commissionPercent` não é nulo, pula a criação da
cobrança Asaas — cria a `Subscription` local direto com `status: 'ACTIVE'`
e sem `asaasSubscriptionId`, atualiza `business.planId`, e retorna
`{ ok: true, invoiceUrl: null }` (o componente que chama essa action trata
"sem link de pagamento" mostrando uma mensagem de "sem mensalidade — você
paga por comissão" em vez de redirecionar pro link de pagamento).

## 5. Inadimplência bloqueia

`src/app/api/webhooks/asaas/route.ts` hoje só resolve `subscriptionId`
(`body.payment.subscription ?? body.subscription?.id`). Passa a também
checar `body.payment?.externalReference` quando não há `subscriptionId` —
se bater com um `CommissionInvoice.id`, despacha pras novas funções em
`src/lib/billing.ts`:

- `markCommissionInvoicePaid(invoiceId)`: `CommissionInvoice.status = 'PAID'`,
  `paidAt = now()`; se `Business.suspendedReason === 'COMMISSION_OVERDUE'`,
  volta `status: 'ACTIVE', suspendedReason: null` (mesmo padrão de
  `activateSubscription`).
- `markCommissionInvoiceOverdue(invoiceId)`: `CommissionInvoice.status =
  'OVERDUE'`; suspende o negócio com `suspendedReason: 'COMMISSION_OVERDUE'`
  — a não ser que já esteja suspenso por `'ADMIN'` (mesma exceção já
  existente em `suspendForPayment`).

## 6. Painel do comerciante

Nova seção "Comissão semanal" dentro de `/comerciante/plano` (só aparece
quando `business.category.commissionPercent` não é nulo): tabela com
Semana, Valor vendido, Comissão, Status, e um link "Pagar" quando
`status === 'PENDING'` ou `'OVERDUE'` (usando o `invoiceUrl` — buscado sob
demanda via a API de pagamento do Asaas, mesmo padrão de
`createAsaasSubscription`, já que `CommissionInvoice` só guarda o
`asaasPaymentId`, não a URL).

## Erros e casos de borda

- Negócio muda de categoria (de uma com comissão pra uma sem, ou
  vice-versa) — o cron seguinte já reflete a categoria atual; faturas já
  geradas não mudam.
- Negócio sem nenhum pedido na semana → nenhuma fatura gerada, sem erro.
- Falha ao criar a cobrança no Asaas (fora do ar, CPF/CNPJ inválido) → o
  cron loga o erro e segue pros próximos negócios (mesmo padrão de
  resiliência do envio de e-mail fire-and-forget já usado em outras
  partes do sistema) — não trava o job inteiro por causa de um negócio.
- Admin muda o percentual de uma categoria no meio da semana → só afeta a
  próxima apuração (a semana corrente já não tem fatura gerada ainda, então
  não há inconsistência).

## Testes

- `src/lib/__tests__/weekly-commission.test.ts` (nova lib
  `src/lib/weekly-commission.ts` com a lógica de cálculo, chamada pela
  rota do cron): cálculo correto da janela da semana, soma excluindo
  pedidos cancelados e excluindo a taxa de entrega, arredondamento do
  `feeCents`, e o caso de soma zero não gerar fatura.
- `src/app/api/cron/__tests__/weekly-commission.test.ts`: autenticação por
  `CRON_SECRET` (mesmo padrão do teste de `expire-trials`, se existir —
  conferir).
- `src/actions/__tests__/merchant-actions.test.ts` (já existe): novo caso
  para `subscribeToPlan` pulando a cobrança Asaas quando a categoria tem
  comissão.
- `src/lib/__tests__/billing.test.ts` (se existir; senão criar): casos para
  `markCommissionInvoicePaid`/`markCommissionInvoiceOverdue`.
- `src/app/api/webhooks/asaas/__tests__/route.test.ts` (se existir):
  roteamento por `externalReference` de `CommissionInvoice` quando não há
  `subscriptionId`.
