# Taxa de Entrega por Bairro — Design

## Objetivo

Hoje o app mobile pede o bairro de entrega como texto livre, sem calcular
nenhuma taxa. O comerciante precisa poder cadastrar, por bairro, o valor da
taxa de entrega da própria loja; o cliente escolhe o bairro em uma lista (não
digita livremente) e vê a taxa somada ao total antes de confirmar o pedido.

Escopo: apenas pedidos com entrega feitos pelo **app mobile** — o site não
tem fluxo de pedido com entrega hoje (só cupom para retirada), e isso não
muda neste projeto.

## Modelo de dados

Novo modelo, um registro por bairro coberto por um comerciante:

```prisma
model DeliveryZone {
  id           String   @id @default(cuid())
  businessId   String
  business     Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  neighborhood String
  feeCents     Int
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@unique([businessId, neighborhood])
  @@map("delivery_zones")
}
```

- `Business` ganha `deliveryZones DeliveryZone[]`.
- `Order` ganha `deliveryFeeCents Int?` (nulo para pedidos sem taxa/antigos).
  O valor é uma cópia (snapshot) da taxa no momento do pedido — mudanças
  futuras na taxa do comerciante não afetam pedidos já feitos.
- O campo `Order.neighborhood` (já existente, texto livre) passa a ser
  preenchido com o nome exato do `DeliveryZone.neighborhood` escolhido.

## Painel do comerciante

Nova rota `/comerciante/entrega`, novo item "Entrega" no menu lateral
(`DashboardShell`, entre "Pedidos" e "Validar cupom").

Tela:
- Formulário no topo: nome do bairro + valor da taxa (R$) → adiciona.
- Lista abaixo: cada bairro cadastrado com taxa, toggle ativo/inativo,
  excluir.
- Nome do bairro é único por comerciante (`@@unique([businessId,
  neighborhood])`); tentar cadastrar um nome repetido edita o existente em
  vez de duplicar.

Novo arquivo `src/actions/delivery-zone-actions.ts` (server actions, mesmo
padrão de autenticação de `requireMerchantBusiness()` usado em
`order-actions.ts`):
- `listDeliveryZones(): DeliveryZone[]`
- `upsertDeliveryZone(input: { id?: string; neighborhood: string; feeCents: number })`
- `deleteDeliveryZone(id: string)`
- `toggleDeliveryZoneActive(id: string, active: boolean)`

## API mobile

`GET /api/mobile/ofertas/[slug]` passa a incluir, quando `deliveryEnabled`,
a lista de zonas ativas do negócio:

```ts
deliveryZones: { id: string; neighborhood: string; feeCents: number }[]
```

`POST /api/mobile/pedidos`: o corpo troca o campo livre `neighborhood` por
`deliveryZoneId: string` (obrigatório para pedido com entrega). O servidor:
1. Busca a `DeliveryZone`, confere que pertence ao `businessId` da oferta e
   está `active`.
2. Se não encontrar → 400 `"Bairro inválido ou indisponível."`.
3. Copia `neighborhood` e `feeCents` da zona para o `Order`
   (`neighborhood`, `deliveryFeeCents`).

Novo endpoint `POST /api/mobile/entrega/interesse`:
```ts
{ businessId: string; neighborhood: string }
```
Valida que o negócio existe e tem `deliveryEnabled` em pelo menos uma
oferta ativa, aplica o rate-limit já usado nas demais rotas mobile, e
dispara `sendDeliveryZoneRequestEmail`. Não cria nenhum registro no banco —
é só um disparo de e-mail (sem histórico a manter, sem tela de
administração).

## E-mail de aviso

Nova função em `src/lib/email.ts`, mesmo padrão de `sendNewOrderEmail`:

```ts
export async function sendDeliveryZoneRequestEmail(
  to: string,
  data: { businessName: string; neighborhood: string },
): Promise<void>
```

Assunto: `Um cliente quer entrega em "${neighborhood}"`. Corpo explica que
um cliente tentou pedir entrega nesse bairro e ainda não está cadastrado,
com um lembrete de que ele pode cadastrar a taxa no painel (link para
`/comerciante/entrega`) se quiser atender a região.

Enviado para `business.email`. Se o negócio não tiver e-mail cadastrado, o
endpoint retorna sucesso sem enviar nada (mesmo comportamento silencioso já
usado para `sendNewOrderEmail` quando aplicável — não é erro do cliente).

## Fluxo no app mobile

`app/oferta/[slug].tsx`: o botão "Pedir com entrega" só é renderizado se
`offer.deliveryEnabled && offer.deliveryZones.length > 0`. Sem bairros
cadastrados pelo comerciante, a entrega fica indisponível — o cliente só vê
o botão de gerar cupom (retirada no local), sem nenhuma tela nova.

`app/pedido/[slug].tsx`: o campo de texto "Bairro" é substituído por uma
lista de seleção com os bairros da oferta e sua taxa (ex.: "Centro — R$
5,00"), mais uma opção final fixa "Meu bairro não está nessa lista".

- Bairro da lista selecionado: `deliveryZoneId` fica pronto para envio;
  o total exibido passa a ser `subtotal + feeCents` da zona escolhida.
- "Meu bairro não está nessa lista": abre um campo de texto para o nome do
  bairro e troca a tela de confirmação por uma mensagem — "Ainda não
  fazemos entrega em `<bairro digitado>`." — com um botão "Avisar o
  estabelecimento", que chama `POST /api/mobile/entrega/interesse` e, ao
  concluir, mostra confirmação ("Aviso enviado! Você pode retirar no local
  usando o cupom.") com um atalho de volta para a tela da oferta. Nenhum
  pedido é criado nesse caminho.

## Erros e casos de borda

- Comerciante tenta cadastrar bairro com taxa negativa ou vazia → validação
  no formulário e no server action (zod), mesma UX de erro dos outros
  formulários do painel.
- Comerciante desativa (toggle) um bairro que está sendo usado por um
  pedido em andamento → não afeta pedidos já criados (a taxa já foi
  copiada); só deixa de aparecer como opção em pedidos novos.
- Comerciante exclui um bairro → mesma coisa: pedidos existentes preservam
  o `neighborhood`/`deliveryFeeCents` já gravados (sem FK do Order para a
  DeliveryZone, então excluir não quebra nada).
- Cliente abre a tela de pedido, comerciante zera todos os bairros nesse
  meio-tempo → a chamada de `POST /api/mobile/pedidos` falha com o mesmo
  400 de "Bairro inválido ou indisponível.", tratado como erro normal de
  formulário na tela.

## Testes

- `src/actions/__tests__/delivery-zone-actions.test.ts`: CRUD completo,
  isolamento por comerciante (um comerciante não vê/edita zona de outro),
  unicidade de nome de bairro por comerciante.
- `src/lib/__tests__/orders.test.ts` (arquivo já existe): novo caso para
  `createOrderForUser` com `deliveryZoneId` válido (snapshot correto de
  `neighborhood`/`deliveryFeeCents`) e caso de zona inválida/inativa (erro
  400).
- `src/lib/__tests__/email.test.ts` (se existir; senão criar): teste de
  `sendDeliveryZoneRequestEmail`, mesmo padrão de mock do Resend usado nos
  outros testes de e-mail.
- App mobile (`app-mobile`): teste do `pedido/[slug].tsx` cobrindo os três
  estados — lista de bairros carregada e total recalculado ao trocar de
  bairro, botão de entrega ausente quando `deliveryZones` vier vazio, e o
  fluxo "bairro fora da lista" disparando o aviso.
