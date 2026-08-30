# CEP Automático no Pedido com Entrega Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente digita o CEP na tela de pedido com entrega e o endereço/cidade/UF preenchem sozinhos, bloqueando a entrega se o CEP for de fora da cidade do comerciante, e tentando casar o bairro automaticamente com a lista de bairros já cadastrada.

**Architecture:** Uma função `lookupCep` no app mobile (mesma lógica já usada no site, chamando a API pública do ViaCEP direto do app, sem endpoint novo no backend) e mudanças na tela `pedido/[slug].tsx` pra usar o resultado.

**Tech Stack:** Expo Router / React Native, Jest, TanStack Query (já em uso na tela).

## Global Constraints

- CEP é **opcional** — preencher manualmente continua funcionando exatamente como hoje.
- Comparação de cidade (CEP × `offer.business.city`/`state`) é case-insensitive.
- Casamento de bairro (CEP × `offer.deliveryZones[].neighborhood`) é `trim().toLowerCase()`.
- Nenhuma mudança no backend — só o app mobile.

---

### Task 1: `lookupCep` no app mobile

**Files:**
- Create: `app-mobile/src/utils/cep.ts`
- Create: `app-mobile/src/utils/__tests__/cep.test.ts`

**Interfaces:**
- Produces: `export type CepResult = { street: string; neighborhood: string; city: string; state: string }`
- Produces: `export async function lookupCep(cep: string): Promise<CepResult | null>`

- [ ] **Step 1: Criar `app-mobile/src/utils/cep.ts`**

```ts
export type CepResult = { street: string; neighborhood: string; city: string; state: string }

/** Looks up a Brazilian CEP via ViaCEP. Returns null on an invalid/unknown CEP or network failure. */
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

- [ ] **Step 2: Testes em `app-mobile/src/utils/__tests__/cep.test.ts`**

Mesmo padrão de `app-mobile/src/api/__tests__/client.test.ts` (mock de `global.fetch`, restaurado no `afterEach`):

```ts
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { lookupCep } from '@/utils/cep'

const originalFetch = global.fetch

describe('lookupCep', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns null without calling fetch when the CEP has fewer than 8 digits', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock

    const result = await lookupCep('1234')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the mapped fields for a valid CEP', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        logradouro: 'Av. Brasil',
        bairro: 'Centro',
        localidade: 'Marmeleiro',
        uf: 'PR',
      }),
    } as Response)

    const result = await lookupCep('85350-000')

    expect(result).toEqual({ street: 'Av. Brasil', neighborhood: 'Centro', city: 'Marmeleiro', state: 'PR' })
    expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/85350000/json/')
  })

  it('returns null when ViaCEP reports the CEP does not exist', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ erro: true }) } as Response)

    const result = await lookupCep('00000000')
    expect(result).toBeNull()
  })

  it('returns null when the request fails', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockRejectedValue(new Error('network error'))

    const result = await lookupCep('85350000')
    expect(result).toBeNull()
  })

  it('returns null when the response is not ok', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) } as Response)

    const result = await lookupCep('85350000')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar os testes**

```bash
cd app-mobile && npx jest src/utils/__tests__/cep.test.ts
```
Esperado: 5/5 passando.

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/utils/cep.ts app-mobile/src/utils/__tests__/cep.test.ts
git commit -m "feat(mobile): CEP lookup via ViaCEP"
```

---

### Task 2: Campo CEP na tela de pedido

**Files:**
- Modify: `app-mobile/app/pedido/[slug].tsx`

**Interfaces:**
- Consumes: `lookupCep` de `app-mobile/src/utils/cep.ts` (Task 1); `offer.business.city`/`offer.business.state` e `offer.deliveryZones` (já existentes em `OfferDetail`).

- [ ] **Step 1: Ler o arquivo atual**

Ler `app-mobile/app/pedido/[slug].tsx` por inteiro antes de editar — o arquivo já tem o fluxo de seleção de bairro (`selectedZoneId`, `OTHER_NEIGHBORHOOD`, `offer.deliveryZones`), e as mudanças abaixo se encaixam nesse fluxo existente sem reescrevê-lo.

- [ ] **Step 2: Adicionar o import**

```ts
import { lookupCep } from '@/utils/cep'
```

- [ ] **Step 3: Adicionar o novo estado**

Junto dos outros `useState` já existentes (`phone`, `address`, `number`, etc.):

```ts
  const [cep, setCep] = useState('')
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'not-found'>('idle')
  const [cityMismatch, setCityMismatch] = useState(false)
```

- [ ] **Step 4: Adicionar `handleCepBlur`**

Logo depois de `handleNotifyInterest` já existente (ambas funções ficam dentro do corpo do componente, depois do `const selectedZone = ...`/`const choosingOther = ...` já existentes, já que precisam de `offer`):

```ts
  async function handleCepBlur() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepStatus('loading')
    const result = await lookupCep(cep)
    if (!result) {
      setCepStatus('not-found')
      return
    }
    setCepStatus('idle')

    const sameCity =
      result.city.trim().toLowerCase() === offer!.business.city.trim().toLowerCase() &&
      result.state.trim().toUpperCase() === offer!.business.state.trim().toUpperCase()

    if (!sameCity) {
      setCityMismatch(true)
      setSelectedZoneId(null)
      return
    }
    setCityMismatch(false)

    setAddress(result.street || address)
    setCity(result.city)
    setState(result.state)

    const matchedZone = offer!.deliveryZones.find(
      (zone) => zone.neighborhood.trim().toLowerCase() === result.neighborhood.trim().toLowerCase(),
    )
    if (matchedZone) {
      setSelectedZoneId(matchedZone.id)
    }
  }
```

- [ ] **Step 5: Adicionar o campo CEP no JSX**

Logo antes do `<TextInput ... placeholder="Endereço" .../>` já existente:

```tsx
      <TextInput
        style={styles.input}
        placeholder="CEP"
        value={cep}
        onChangeText={setCep}
        onBlur={handleCepBlur}
        keyboardType="numeric"
        maxLength={9}
      />
      {cepStatus === 'loading' && <Text style={styles.cepHint}>Buscando endereço...</Text>}
      {cepStatus === 'not-found' && <Text style={styles.cepError}>CEP não encontrado, preencha manualmente.</Text>}
      {cityMismatch && (
        <Text style={styles.cepError}>
          Esse CEP é de fora da área atendida por {offer.business.name}. Você pode retirar no local usando o cupom.
        </Text>
      )}
```

- [ ] **Step 6: Ajustar `canSubmit`**

Trocar:

```ts
  const canSubmit = !createOrder.isPending && phone && address && city && state.length === 2 && !!selectedZone
```

por:

```ts
  const canSubmit = !createOrder.isPending && phone && address && city && state.length === 2 && !!selectedZone && !cityMismatch
```

- [ ] **Step 7: Adicionar os dois novos estilos**

No `StyleSheet.create` já existente, junto de `error: { color: colors.red, ... }`:

```ts
  cepHint: { fontSize: 12, color: colors.neutral500 },
  cepError: { fontSize: 12, color: colors.red, fontWeight: '600' },
```

Antes de aplicar, conferir no arquivo atual que `colors.red`/`colors.neutral500` já são usados em outro lugar do mesmo arquivo (já são — `error`/`successText`/`business` já os usam) — não introduzir nenhum token de cor novo.

- [ ] **Step 8: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 9: Commit**

```bash
git add app-mobile/app/pedido/\[slug\].tsx
git commit -m "feat(mobile): autofill delivery address from CEP, block out-of-city delivery, auto-match neighborhood"
```

---

### Task 3: Build final, testes completos e deploy

**Files:** nenhum novo — apenas execução e verificação.

- [ ] **Step 1: Testes e tipos do app mobile**

```bash
cd app-mobile
npx tsc --noEmit
npx jest
```
Esperado: tudo passando/sem erros.

- [ ] **Step 2: Rebuild do export web do app mobile e sync**

```bash
cd app-mobile
npx expo export --platform web --clear
```
Copiar o conteúdo de `app-mobile/dist/` para `public/app/` (mesmo processo já usado nas features anteriores desta sessão).

- [ ] **Step 3: Testes do site e build final**

```bash
npx vitest run
npm run build
```

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod
```
Se falhar com o erro transitório `"Not authorized"`, rodar `npx vercel link --yes` e tentar de novo.

- [ ] **Step 5: Verificação manual em produção**

Usando o navegador: abrir `/app`, entrar como cliente, ir numa oferta com entrega, abrir a tela de pedido, confirmar que o campo CEP aparece antes de Endereço.
