# CEP Automático no Pedido com Entrega — Design

## Objetivo

Hoje o cliente digita endereço, cidade e UF manualmente na tela de pedido do
app (`app-mobile/app/pedido/[slug].tsx`), e escolhe o bairro numa lista (já
existente, da feature de taxa de entrega). Este projeto adiciona um campo de
CEP que preenche endereço/cidade/UF automaticamente (mesma integração
ViaCEP já usada no cadastro do comerciante no site), bloqueia a entrega se o
CEP for de fora da cidade atendida pelo comerciante, e tenta casar o bairro
retornado com um dos já cadastrados pelo comerciante.

## 1. `lookupCep` no app mobile

Novo arquivo `app-mobile/src/utils/cep.ts`, mesma lógica de
`src/lib/cep.ts` (o site já chama a API pública do ViaCEP direto do
navegador, sem passar pelo nosso backend — o app mobile faz o mesmo, sem
precisar de endpoint novo):

```ts
export type CepResult = { street: string; neighborhood: string; city: string; state: string }

export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.erro) return null

    return {
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}
```

## 2. Tela de pedido — campo CEP

Novo campo "CEP" no topo do formulário, antes de "Endereço". Estado novo:
`cep`, `cepStatus: 'idle' | 'loading' | 'not-found'`, `cityMismatch:
boolean`.

Ao perder o foco do campo (`onBlur`), com CEP de 8 dígitos:
1. `lookupCep(cep)`.
2. CEP não encontrado → `cepStatus = 'not-found'`, mostra "CEP não
   encontrado, preencha manualmente." (mesmo texto já usado no site).
3. CEP encontrado, cidade **diferente** da cidade do comerciante
   (`offer.business.city`/`state`, comparação sem diferenciar
   maiúsculas/minúsculas) → `cityMismatch = true`, limpa a seleção de bairro
   (`selectedZoneId = null`), **não** preenche endereço/cidade/UF. Mostra
   mensagem bloqueante: "Esse CEP é de fora da área atendida por
   `{business.name}`. Você pode retirar no local usando o cupom." — sem
   nenhum botão de "avisar o estabelecimento" aqui (esse fluxo já existe
   pra bairro fora da lista dentro da cidade certa; CEP de outra cidade é
   um caso mais categórico, sem ambiguidade).
4. CEP encontrado, cidade bate → `cityMismatch = false`, preenche
   `address` (rua), `city`, `state` (os três continuam editáveis
   manualmente depois, igual já é hoje). Tenta casar `result.neighborhood`
   (comparação `trim().toLowerCase()`) com o `neighborhood` de algum item
   de `offer.deliveryZones` — se achar, `setSelectedZoneId(matched.id)`
   (a taxa já aparece selecionada); se não achar, a lista de bairros
   continua do jeito que já funciona hoje (cliente escolhe manualmente ou
   usa "Meu bairro não está nessa lista").

`canSubmit` ganha mais uma condição: `&& !cityMismatch`.

CEP é **opcional** — quem não preencher continua digitando endereço/bairro/
cidade/UF manualmente, exatamente como funciona hoje.

## Erros e casos de borda

- ViaCEP fora do ar / CEP inválido → mesmo tratamento de "not found":
  mensagem pra preencher manualmente, sem travar a tela.
- Cliente preenche pelo CEP e depois edita a cidade manualmente pra outra
  diferente da atendida → fora de escopo checar isso em tempo real (só o
  preenchimento via CEP dispara a checagem de cidade); a validação de
  bairro/entrega no back-end já existe e barra no envio de qualquer forma
  (`deliveryZoneId` inválido ou inexistente).
- Comerciante sem nenhum bairro cadastrado ainda → tela de pedido nem
  aparece pro cliente (já bloqueado numa feature anterior); CEP não muda
  esse comportamento.

## Testes

- `app-mobile/src/utils/__tests__/cep.test.ts` (novo, Jest, mock de
  `global.fetch` — mesmo padrão dos outros testes de função pura do app
  mobile, ex. `money.test.ts`): CEP válido retorna os campos certos, CEP
  com 8 dígitos mas resposta `{ erro: true }` retorna `null`, CEP com
  menos de 8 dígitos retorna `null` sem chamar `fetch`, falha de rede
  retorna `null`.
- Sem teste de componente pra `pedido/[slug].tsx` (o app mobile não tem
  esse tipo de teste, mesma convenção já usada nas features anteriores) —
  a lógica de casar bairro por nome pode ser extraída como função pura
  testável se ficar complexa o suficiente para justificar (avaliar no
  plano de implementação).
