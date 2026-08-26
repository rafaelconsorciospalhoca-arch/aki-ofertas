# App Mobile (React Native) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o app Expo/React Native do consumidor (`app-mobile/`), consumindo os 12 endpoints já existentes em `src/app/api/mobile/**`: onboarding de localização, ofertas, loja, cupons, login (Google + e-mail/código) e perfil.

**Architecture:** Projeto Expo independente dentro do mesmo repositório (`app-mobile/`), Expo Router para navegação, TanStack Query para dados, `expo-secure-store` para sessão/localização salvas no aparelho.

**Tech Stack:** Expo (managed), Expo Router, TypeScript, `@tanstack/react-query`, `expo-secure-store`, `expo-location`, `expo-auth-session` (Google), Jest (testes de unidade).

## Global Constraints

- Todo o código novo vive em `app-mobile/` — nunca mexe em nada de `src/` (o site Next.js).
- `app-mobile/` é um projeto Node independente: `package.json`, `node_modules`, testes próprios.
- `.gitignore` da raiz precisa ganhar entradas pra `app-mobile/node_modules/`, `app-mobile/.expo/`, `app-mobile/dist/` (o `/node_modules` atual só cobre a raiz).
- Base URL da API: `EXPO_PUBLIC_API_URL` (variável pública do Expo, acessível no client), com fallback pra `https://akiofertas.com.br` em produção.
- Toda tela autenticada usa o token salvo via `expo-secure-store` — nunca guarda o token em `AsyncStorage` puro ou em memória apenas.
- Cores da marca (`src/theme/colors.ts`, exatas do `tailwind.config.ts` do site): `navy #0B1B33`, `navyDark #071022`, `green #17A94E`, `greenLight #22C55E`.
- `GOOGLE_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID`/`GOOGLE_ANDROID_CLIENT_ID` ainda não existem (nenhum projeto foi criado no Google Cloud Console até este ponto) — o botão "Cadastrar com Google" é implementado por completo, mas só pode ser testado de ponta a ponta quando essas credenciais existirem. Mesma pendência já registrada no plano da API Mobile.
- A API já calcula distância no servidor (`distanceKm`/`distanceLabel` em `OfferListItem`) — o app NÃO reimplementa a fórmula de Haversine, só formata o que a API já manda.
- Sem testes end-to-end (Detox/Maestro) neste plano — só testes de unidade para funções puras (cliente HTTP, formatação de preço) e verificação manual das telas no simulador/emulador.
- Ícone/splash screen do app ficam com os assets padrão do Expo nesta primeira versão — identidade visual real (ícone customizado) é um polish separado, fora de escopo aqui.

---

### Task 1: Scaffold do projeto Expo + navegação

**Files:**
- Create: `app-mobile/` (projeto Expo completo via CLI)
- Create: `app-mobile/src/theme/colors.ts`
- Create: `app-mobile/app/_layout.tsx`
- Create: `app-mobile/app/(tabs)/_layout.tsx`
- Create: `app-mobile/app/(tabs)/index.tsx`
- Create: `app-mobile/app/(tabs)/cupons.tsx`
- Create: `app-mobile/app/(tabs)/perfil.tsx`
- Modify: `.gitignore` (raiz do repositório)

**Interfaces:**
- Consumes: nada — primeiro task do plano.
- Produces: estrutura de navegação (3 abas), `colors` (paleta da marca) que todo task seguinte importa.

- [ ] **Step 1: Criar o projeto Expo**

Run (na raiz do repositório):
```bash
npx create-expo-app@latest app-mobile --template blank-typescript
```
Expected: pasta `app-mobile/` criada com `package.json`, `app.json`, `tsconfig.json`, `App.tsx` (template padrão).

- [ ] **Step 2: Instalar Expo Router e as dependências deste plano**

Run (dentro de `app-mobile/`):
```bash
cd app-mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install expo-secure-store expo-location expo-auth-session expo-web-browser
npm install @tanstack/react-query
```

- [ ] **Step 3: Configurar o `package.json` e `app.json` para o Expo Router**

Em `app-mobile/package.json`, garantir que `main` aponta pro entrypoint do Router:
```json
{
  "main": "expo-router/entry"
}
```

Em `app-mobile/app.json`, dentro de `expo`, adicionar/confirmar:
```json
{
  "expo": {
    "name": "Aki Ofertas",
    "slug": "aki-ofertas",
    "scheme": "akiofertas",
    "plugins": ["expo-router"]
  }
}
```
(`scheme` é necessário pro fluxo de redirect do login com Google, no Task 9.)

Apagar `App.tsx` da raiz de `app-mobile/` (o template `blank-typescript` cria um `App.tsx` que não é mais usado quando `expo-router/entry` é o entrypoint).

- [ ] **Step 4: Criar o `tsconfig.json` com alias `@/*`**

Editar `app-mobile/tsconfig.json` para incluir o path alias usado em todo o resto do plano:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: Criar a paleta de cores**

```typescript
// app-mobile/src/theme/colors.ts
export const colors = {
  navy: '#0B1B33',
  navyDark: '#071022',
  green: '#17A94E',
  greenLight: '#22C55E',
  white: '#FFFFFF',
  neutral100: '#F5F5F5',
  neutral200: '#E5E5E5',
  neutral400: '#A3A3A3',
  neutral500: '#737373',
  neutral900: '#171717',
  red: '#EF4444',
} as const
```

- [ ] **Step 6: Criar o layout raiz**

```tsx
// app-mobile/app/_layout.tsx
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  )
}
```

**Nota:** o layout raiz usa `<Stack>`, não `<Slot>`, porque várias telas dos próximos tasks (`ofertas.tsx`, `oferta/[slug].tsx`, `loja/[slug].tsx`, `entrar.tsx`) usam `<Stack.Screen options={{...}}>` dentro de si mesmas pra configurar título/apresentação modal — isso exige um `<Stack>` ancestral de verdade fornecendo esse contexto de navegação, não funciona sob um `<Slot>` puro. Só a entrada `(tabs)` desliga o header (o `Tabs` navigator dentro dela cuida da própria barra, sem header de Stack por cima) — todas as outras rotas (oferta, loja, lista de ofertas, entrar) mantêm o header padrão do Stack, com botão de voltar, e cada uma customiza só o título via seu próprio `Stack.Screen options={{title:...}}`. A tela de onboarding (Task 4) é a exceção — ela mesma desliga o próprio header, porque é uma tela cheia sem necessidade de voltar.

- [ ] **Step 7: Criar a barra de abas**

```tsx
// app-mobile/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { colors } from '@/theme/colors'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.neutral400,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="cupons" options={{ title: 'Cupons' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  )
}
```

- [ ] **Step 8: Criar as três telas placeholder das abas**

```tsx
// app-mobile/app/(tabs)/index.tsx
import { View, Text, StyleSheet } from 'react-native'

export default function InicioScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Início</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18, fontWeight: '700' },
})
```

```tsx
// app-mobile/app/(tabs)/cupons.tsx
import { View, Text, StyleSheet } from 'react-native'

export default function CuponsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Cupons</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18, fontWeight: '700' },
})
```

```tsx
// app-mobile/app/(tabs)/perfil.tsx
import { View, Text, StyleSheet } from 'react-native'

export default function PerfilScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Perfil</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18, fontWeight: '700' },
})
```

- [ ] **Step 9: Atualizar o `.gitignore` da raiz**

Em `.gitignore` (raiz do repositório, não dentro de `app-mobile/`), acrescentar ao final:
```
# app-mobile (Expo)
app-mobile/node_modules
app-mobile/.expo
app-mobile/dist
```

- [ ] **Step 10: Verificar que o app sobe**

Run: `cd app-mobile && npx tsc --noEmit`
Expected: sem erros.

Run: `cd app-mobile && npx expo start` (deixe rodando alguns segundos e então encerre com Ctrl+C — só confirmando que o Metro bundler inicia sem erro de configuração)
Expected: o Metro bundler inicia sem exceção (não precisa abrir num dispositivo/simulador de verdade neste step — isso é verificado manualmente no fim de cada task seguinte que adiciona uma tela real).

- [ ] **Step 11: Commitar**

```bash
cd ..
git add app-mobile .gitignore
git commit -m "Scaffold Expo app with router navigation shell"
```

---

### Task 2: Cliente de API + TanStack Query

**Files:**
- Create: `app-mobile/src/api/client.ts`
- Create: `app-mobile/src/api/types.ts`
- Create: `app-mobile/src/utils/money.ts`
- Test: `app-mobile/src/api/__tests__/client.test.ts`
- Test: `app-mobile/src/utils/__tests__/money.test.ts`
- Modify: `app-mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores (além da estrutura de pastas do Task 1).
- Produces:
  - `class ApiError extends Error { status: number }`
  - `apiFetch<T>(path: string, options?: {method?: string; body?: unknown; token?: string | null}): Promise<T>`
  - Tipos: `OfferListItem`, `Category`, `City`, `OfferDetail`, `BusinessDetail`, `CouponRow`, `Profile` (espelham exatamente o que os endpoints da API mobile já devolvem).
  - `formatCents(cents: number): string`

- [ ] **Step 1: Instalar o Jest do template Expo**

Run: `cd app-mobile && npx expo install jest-expo jest @types/jest`

Adicionar em `app-mobile/package.json`:
```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 2: Escrever os testes**

```typescript
// app-mobile/src/api/__tests__/client.test.ts
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { apiFetch, ApiError } from '@/api/client'

const originalFetch = global.fetch

describe('apiFetch', () => {
  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns the data field on a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, data: [{ id: 'o1' }] }),
    }) as never

    const result = await apiFetch('/ofertas/destaque')
    expect(result).toEqual([{ id: 'o1' }])
  })

  it('returns the whole payload when there is no data field (auth responses)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, token: 'abc', user: { id: 'u1' } }),
    }) as never

    const result = await apiFetch('/auth/google')
    expect(result).toEqual({ ok: true, token: 'abc', user: { id: 'u1' } })
  })

  it('throws an ApiError with the server message on ok:false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 400,
      json: async () => ({ ok: false, error: 'Oferta não encontrada.' }),
    }) as never

    await expect(apiFetch('/ofertas/nope')).rejects.toThrow('Oferta não encontrada.')
  })

  it('throws an ApiError carrying the HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ ok: false, error: 'Sessão expirada.' }),
    }) as never

    try {
      await apiFetch('/cupons')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(401)
    }
  })

  it('sends the Authorization header when a token is given', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, data: [] }),
    })
    global.fetch = fetchMock as never

    await apiFetch('/cupons', { token: 'my-token' })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer my-token')
  })

  it('does not send an Authorization header when there is no token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, data: [] }),
    })
    global.fetch = fetchMock as never

    await apiFetch('/categorias')

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('sends a JSON body for POST requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, coupon: { code: 'AK1234' } }),
    })
    global.fetch = fetchMock as never

    await apiFetch('/cupons/gerar', { method: 'POST', body: { offerId: 'offer-1' } })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ offerId: 'offer-1' }))
  })
})
```

```typescript
// app-mobile/src/utils/__tests__/money.test.ts
import { describe, expect, it } from '@jest/globals'
import { formatCents } from '@/utils/money'

describe('formatCents', () => {
  it('formats cents as BRL currency', () => {
    expect(formatCents(2990)).toBe(
      (2990 / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    )
  })

  it('handles zero', () => {
    expect(formatCents(0)).toBe((0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
  })
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `cd app-mobile && npx jest`
Expected: FAIL — os módulos `@/api/client` e `@/utils/money` ainda não existem.

- [ ] **Step 4: Implementar `src/utils/money.ts`**

```typescript
// app-mobile/src/utils/money.ts
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
```

- [ ] **Step 5: Implementar `src/api/client.ts`**

```typescript
// app-mobile/src/api/client.ts
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://akiofertas.com.br'

type ApiFetchOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(`${BASE_URL}/api/mobile${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const json = await response.json().catch(() => null)

  if (!json || json.ok !== true) {
    throw new ApiError(json?.error ?? 'Erro ao conectar com o servidor.', response.status)
  }

  return ('data' in json ? json.data : json) as T
}
```

- [ ] **Step 6: Implementar `src/api/types.ts`**

```typescript
// app-mobile/src/api/types.ts
export type OfferListItem = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  businessName: string
  businessSlug: string
  distanceKm: number | null
  distanceLabel: string | null
}

export type Category = { id: string; name: string; icon: string; order: number }

export type City = { id: string; name: string; state: string }

export type OfferDetail = {
  id: string
  slug: string
  title: string
  description: string | null
  imageUrl: string | null
  originalPrice: number
  discountPrice: number
  discountPercent: number
  quantityAvailable: number | null
  startDate: string
  endDate: string
  business: {
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
  }
}

export type BusinessDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  categoryName: string
  city: string
  state: string
  phone: string | null
  whatsapp: string | null
  offers: OfferListItem[]
}

export type CouponRow = {
  id: string
  code: string
  status: 'VALID' | 'USED' | 'EXPIRED'
  generatedAt: string
  usedAt: string | null
  expiresAt: string
  offerId: string
  offerTitle: string
  offerSlug: string
  businessName: string
  businessSlug: string
}

export type Profile = {
  id: string
  name: string
  email: string
  city: string | null
}
```

- [ ] **Step 7: Ligar o `QueryClientProvider` no layout raiz**

Editar `app-mobile/app/_layout.tsx`:

```tsx
// app-mobile/app/_layout.tsx
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 8: Rodar os testes e confirmar que passam**

Run: `cd app-mobile && npx jest`
Expected: PASS (9 testes)

- [ ] **Step 9: Checar tipos e commitar**

Run: `cd app-mobile && npx tsc --noEmit`

```bash
cd ..
git add app-mobile
git commit -m "Add API client, shared types, and TanStack Query provider"
```

---

### Task 3: Sessão (token) e localização salvos no aparelho

**Files:**
- Create: `app-mobile/src/auth/AuthContext.tsx`
- Create: `app-mobile/src/storage/location.ts`
- Test: `app-mobile/src/storage/__tests__/location.test.ts`
- Modify: `app-mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `apiFetch`/`ApiError` (Task 2).
- Produces:
  - `AuthProvider` (componente), `useAuth(): {token, user, loading, login, logout, authedFetch}`
  - `type StoredLocation = {type:'gps'; lat:number; lng:number} | {type:'city'; name:string; state:string}`
  - `getStoredLocation(): Promise<StoredLocation | null>`, `setStoredLocation(location: StoredLocation): Promise<void>`

Este task não testa `AuthContext.tsx` diretamente (componente React com `expo-secure-store` real é melhor verificado manualmente, no Task 4 em diante, quando há telas de verdade usando o contexto) — só a lib de armazenamento de localização, que é pura o suficiente pra mockar.

- [ ] **Step 1: Escrever os testes de `location.ts`**

```typescript
// app-mobile/src/storage/__tests__/location.test.ts
import { describe, expect, it, jest, afterEach } from '@jest/globals'
import * as SecureStore from 'expo-secure-store'
import { getStoredLocation, setStoredLocation } from '@/storage/location'

jest.mock('expo-secure-store')

describe('getStoredLocation', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when nothing is stored', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null)
    const result = await getStoredLocation()
    expect(result).toBeNull()
  })

  it('parses a stored GPS location', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ type: 'gps', lat: -25.9, lng: -53.05 }),
    )
    const result = await getStoredLocation()
    expect(result).toEqual({ type: 'gps', lat: -25.9, lng: -53.05 })
  })

  it('parses a stored manual city', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ type: 'city', name: 'Marmeleiro', state: 'PR' }),
    )
    const result = await getStoredLocation()
    expect(result).toEqual({ type: 'city', name: 'Marmeleiro', state: 'PR' })
  })
})

describe('setStoredLocation', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('stores the location as JSON', async () => {
    await setStoredLocation({ type: 'city', name: 'Marmeleiro', state: 'PR' })
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'aki_location',
      JSON.stringify({ type: 'city', name: 'Marmeleiro', state: 'PR' }),
    )
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd app-mobile && npx jest location.test.ts`
Expected: FAIL — `@/storage/location` não existe.

- [ ] **Step 3: Implementar `src/storage/location.ts`**

```typescript
// app-mobile/src/storage/location.ts
import * as SecureStore from 'expo-secure-store'

const LOCATION_KEY = 'aki_location'

export type StoredLocation =
  | { type: 'gps'; lat: number; lng: number }
  | { type: 'city'; name: string; state: string }

export async function getStoredLocation(): Promise<StoredLocation | null> {
  const raw = await SecureStore.getItemAsync(LOCATION_KEY)
  return raw ? (JSON.parse(raw) as StoredLocation) : null
}

export async function setStoredLocation(location: StoredLocation): Promise<void> {
  await SecureStore.setItemAsync(LOCATION_KEY, JSON.stringify(location))
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd app-mobile && npx jest location.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Implementar `src/auth/AuthContext.tsx`**

```tsx
// app-mobile/src/auth/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { apiFetch, ApiError } from '@/api/client'

const TOKEN_KEY = 'aki_token'

export type AuthUser = { id: string; name: string; email: string }

type AuthedFetchOptions = { method?: string; body?: unknown }

type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  loading: boolean
  login: (token: string, user: AuthUser) => Promise<void>
  logout: () => Promise<void>
  authedFetch: <T>(path: string, options?: AuthedFetchOptions) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then((stored) => {
      setToken(stored)
      setLoading(false)
    })
  }, [])

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const authedFetch = useCallback(
    async <T,>(path: string, options: AuthedFetchOptions = {}): Promise<T> => {
      try {
        return await apiFetch<T>(path, { ...options, token })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await logout()
        }
        throw err
      }
    },
    [token, logout],
  )

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, authedFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
```

- [ ] **Step 6: Ligar o `AuthProvider` no layout raiz**

Editar `app-mobile/app/_layout.tsx` — envolver o conteúdo já existente com `AuthProvider`:

```tsx
// app-mobile/app/_layout.tsx
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 7: Checar tipos, rodar a suíte completa, e commitar**

Run: `cd app-mobile && npx tsc --noEmit && npx jest`
Expected: sem erros; suíte completa passando

```bash
cd ..
git add app-mobile
git commit -m "Add auth context and location storage"
```

---

### Task 4: Onboarding (localização/cidade)

**Files:**
- Create: `app-mobile/app/onboarding.tsx`
- Create: `app-mobile/src/api/hooks/useCities.ts`
- Modify: `app-mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `getStoredLocation`/`setStoredLocation` (Task 3), `apiFetch` + `City` (Task 2).
- Produces: `useCities(): UseQueryResult<City[]>` (hook reaproveitado por outras telas que precisam da lista de cidades, se necessário no futuro).

Este task não tem teste automatizado — a tela mistura permissão de sistema (`expo-location`) e navegação, melhor verificada manualmente no simulador/emulador.

- [ ] **Step 1: Criar o hook de cidades**

```typescript
// app-mobile/src/api/hooks/useCities.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { City } from '@/api/types'

export function useCities() {
  return useQuery({
    queryKey: ['cidades'],
    queryFn: () => apiFetch<City[]>('/cidades'),
  })
}
```

- [ ] **Step 2: Criar a tela de onboarding**

```tsx
// app-mobile/app/onboarding.tsx
import { useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Pressable, FlatList } from 'react-native'
import * as Location from 'expo-location'
import { router, Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { setStoredLocation } from '@/storage/location'
import { useCities } from '@/api/hooks/useCities'

export default function OnboardingScreen() {
  const [requesting, setRequesting] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const cities = useCities()

  async function handleAllowLocation() {
    setRequesting(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setShowCityPicker(true)
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      await setStoredLocation({
        type: 'gps',
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      })
      router.replace('/(tabs)')
    } finally {
      setRequesting(false)
    }
  }

  async function handleSelectCity(name: string, state: string) {
    await setStoredLocation({ type: 'city', name, state })
    router.replace('/(tabs)')
  }

  if (showCityPicker) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.title}>Escolha sua cidade</Text>
        {cities.isLoading && <ActivityIndicator color={colors.green} />}
        <FlatList
          data={cities.data ?? []}
          keyExtractor={(city) => city.id}
          renderItem={({ item }) => (
            <Pressable style={styles.cityRow} onPress={() => handleSelectCity(item.name, item.state)}>
              <Text style={styles.cityText}>
                {item.name} · {item.state}
              </Text>
            </Pressable>
          )}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.logo}>
        Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
      </Text>
      <Text style={styles.subtitle}>Ofertas de comércios pertinho de você</Text>
      <Pressable style={styles.primaryButton} onPress={handleAllowLocation} disabled={requesting}>
        {requesting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Permitir localização</Text>
        )}
      </Pressable>
      <Pressable onPress={() => setShowCityPicker(true)}>
        <Text style={styles.linkText}>Escolher cidade manualmente</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.navy },
  logo: { fontSize: 28, fontWeight: '800', color: colors.white, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.neutral200, marginBottom: 32, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.green,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 240,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.neutral200, fontSize: 13, textDecorationLine: 'underline' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, marginTop: 48 },
  cityRow: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  cityText: { fontSize: 15 },
})
```

- [ ] **Step 3: Redirecionar pro onboarding quando não há localização salva**

Editar `app-mobile/app/_layout.tsx` — adicionar a checagem logo após o `AuthProvider` carregar, dentro de um componente interno (não dá pra usar `useEffect`+`router` diretamente no componente que declara os providers, porque `router` só funciona dentro da árvore de navegação do `Stack`; criar um componente `OnboardingGate` que fica DENTRO dessa árvore, envolvendo o `<Stack>`):

```tsx
// app-mobile/app/_layout.tsx
import { Stack, router, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import { getStoredLocation } from '@/storage/location'

const queryClient = new QueryClient()

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const segments = useSegments()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getStoredLocation().then((location) => {
      const onOnboarding = segments[0] === 'onboarding'
      if (!location && !onOnboarding) {
        router.replace('/onboarding')
      }
      setChecked(true)
    })
  }, [segments])

  if (!checked) return null
  return <>{children}</>
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OnboardingGate>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </OnboardingGate>
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

**Nota:** essa checagem roda a cada mudança de rota (`segments` como dependência) — é intencional: garante que, se o usuário de alguma forma navegar de volta pro onboarding sem localização salva, a checagem não entra em loop (já está em `/onboarding`, `onOnboarding` é `true`, não redireciona de novo).

- [ ] **Step 4: Checar tipos**

Run: `cd app-mobile && npx tsc --noEmit`

- [ ] **Step 5: Verificar manualmente**

Suba `npx expo start` dentro de `app-mobile/`, abra num simulador/emulador. Primeira abertura deve cair em `/onboarding`. Testar os dois caminhos: permitir localização (deve ir pra `/(tabs)`) e "Escolher cidade manualmente" (lista carrega da API, selecionar uma cidade deve ir pra `/(tabs)`).

- [ ] **Step 6: Commitar**

```bash
git add app-mobile
git commit -m "Add onboarding screen with location permission and manual city fallback"
```

---

### Task 5: Início (ofertas em destaque + categorias)

**Files:**
- Create: `app-mobile/src/components/OfferCard.tsx`
- Create: `app-mobile/src/api/hooks/useFeaturedOffers.ts`
- Create: `app-mobile/src/api/hooks/useCategories.ts`
- Modify: `app-mobile/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `OfferListItem`/`Category` (Task 2), `getStoredLocation` (Task 3), `formatCents` (Task 2).
- Produces: `OfferCard` (componente reaproveitado no Task 6 — lista de ofertas com filtro), `useFeaturedOffers(location)`, `useCategories()`.

Sem teste automatizado (componente de UI) — verificação manual.

- [ ] **Step 1: Criar os hooks de dados**

```typescript
// app-mobile/src/api/hooks/useFeaturedOffers.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { OfferListItem } from '@/api/types'
import type { StoredLocation } from '@/storage/location'

function buildQueryString(location: StoredLocation | null): string {
  const params = new URLSearchParams()
  if (location?.type === 'gps') {
    params.set('lat', String(location.lat))
    params.set('lng', String(location.lng))
  } else if (location?.type === 'city') {
    params.set('cidade', `${location.name}|${location.state}`)
  }
  return params.toString()
}

export function useFeaturedOffers(location: StoredLocation | null) {
  const query = buildQueryString(location)
  return useQuery({
    queryKey: ['ofertas-destaque', query],
    queryFn: () => apiFetch<OfferListItem[]>(`/ofertas/destaque?${query}`),
    enabled: location !== null,
  })
}
```

```typescript
// app-mobile/src/api/hooks/useCategories.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { Category } from '@/api/types'

export function useCategories() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => apiFetch<Category[]>('/categorias'),
  })
}
```

- [ ] **Step 2: Criar o componente `OfferCard`**

```tsx
// app-mobile/src/components/OfferCard.tsx
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import type { OfferListItem } from '@/api/types'

export function OfferCard({ offer }: { offer: OfferListItem }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/oferta/${offer.slug}`)}>
      <View style={styles.imageWrapper}>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{offer.discountPercent}%</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{offer.title}</Text>
        <Text style={styles.business} numberOfLines={1}>{offer.businessName}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>{formatCents(offer.originalPrice)}</Text>
          <Text style={styles.discountPrice}>{formatCents(offer.discountPrice)}</Text>
        </View>
        {offer.distanceLabel && <Text style={styles.distance}>{offer.distanceLabel}</Text>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.neutral200 },
  imageWrapper: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.neutral100 },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', backgroundColor: colors.neutral100 },
  discountBadge: { position: 'absolute', left: 4, top: 4, backgroundColor: colors.red, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  discountText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  info: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  business: { fontSize: 12, color: colors.neutral500 },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline', marginTop: 4 },
  originalPrice: { fontSize: 12, color: colors.neutral400, textDecorationLine: 'line-through' },
  discountPrice: { fontSize: 16, fontWeight: '700', color: colors.green },
  distance: { fontSize: 11, color: colors.neutral400, marginTop: 2 },
})
```

- [ ] **Step 3: Implementar a tela Início**

```tsx
// app-mobile/app/(tabs)/index.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { useFeaturedOffers } from '@/api/hooks/useFeaturedOffers'
import { useCategories } from '@/api/hooks/useCategories'
import { getStoredLocation, type StoredLocation } from '@/storage/location'

export default function InicioScreen() {
  const [location, setLocation] = useState<StoredLocation | null>(null)

  useEffect(() => {
    getStoredLocation().then(setLocation)
  }, [])

  const offers = useFeaturedOffers(location)
  const categories = useCategories()

  return (
    <FlatList
      data={offers.data ?? []}
      keyExtractor={(offer) => offer.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.logo}>
            Aki<Text style={{ color: colors.greenLight }}>Ofertas</Text>
          </Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories.data ?? []}
            keyExtractor={(category) => category.id}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryText}>{item.name}</Text>
              </View>
            )}
          />
          <Pressable onPress={() => router.push('/ofertas')}>
            <Text style={styles.seeAllText}>Ver todas as ofertas</Text>
          </Pressable>
          {offers.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <OfferCard offer={item} />
        </View>
      )}
      ListEmptyComponent={
        !offers.isLoading ? <Text style={styles.emptyText}>Nenhuma oferta em destaque por aqui ainda.</Text> : null
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  header: { padding: 16, gap: 12 },
  logo: { fontSize: 20, fontWeight: '800', color: colors.navy },
  categoryList: { gap: 8 },
  categoryChip: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  categoryText: { fontSize: 12, fontWeight: '600', color: colors.neutral900 },
  seeAllText: { color: colors.green, fontWeight: '700', fontSize: 13 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
})
```

- [ ] **Step 4: Checar tipos**

Run: `cd app-mobile && npx tsc --noEmit`

- [ ] **Step 5: Verificar manualmente**

No simulador/emulador (depois de já ter passado pelo onboarding), a aba Início deve mostrar o logo, as categorias em uma lista horizontal, e as ofertas em destaque como cards clicáveis (o clique vai falhar por enquanto — a tela `/oferta/[slug]` só é criada no Task 7 — isso é esperado neste ponto do plano).

- [ ] **Step 6: Commitar**

```bash
git add app-mobile
git commit -m "Add Início tab with featured offers and categories"
```

---

### Task 6: Lista de ofertas com filtro

**Files:**
- Create: `app-mobile/app/ofertas.tsx`
- Create: `app-mobile/src/api/hooks/useOffersList.ts`

**Interfaces:**
- Consumes: `OfferCard` (Task 5), `apiFetch`/`OfferListItem` (Task 2), `getStoredLocation` (Task 3).

Sem teste automatizado — verificação manual.

- [ ] **Step 1: Criar o hook de listagem filtrada**

```typescript
// app-mobile/src/api/hooks/useOffersList.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { OfferListItem } from '@/api/types'
import type { StoredLocation } from '@/storage/location'

export function useOffersList(
  location: StoredLocation | null,
  filters: { categoria?: string; raio?: number },
) {
  const params = new URLSearchParams()
  if (location?.type === 'gps') {
    params.set('lat', String(location.lat))
    params.set('lng', String(location.lng))
  } else if (location?.type === 'city') {
    params.set('cidade', `${location.name}|${location.state}`)
  }
  if (filters.categoria) params.set('categoria', filters.categoria)
  if (filters.raio) params.set('raio', String(filters.raio))
  const query = params.toString()

  return useQuery({
    queryKey: ['ofertas', query],
    queryFn: () => apiFetch<OfferListItem[]>(`/ofertas?${query}`),
    enabled: location !== null,
  })
}
```

- [ ] **Step 2: Criar a tela de listagem**

```tsx
// app-mobile/app/ofertas.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from 'react-native'
import { Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { useOffersList } from '@/api/hooks/useOffersList'
import { useCategories } from '@/api/hooks/useCategories'
import { getStoredLocation, type StoredLocation } from '@/storage/location'

const RADIUS_OPTIONS = [1, 3, 5, 10, 20]

export default function OfertasScreen() {
  const [location, setLocation] = useState<StoredLocation | null>(null)
  const [categoria, setCategoria] = useState<string | undefined>(undefined)
  const [raio, setRaio] = useState<number | undefined>(undefined)

  useEffect(() => {
    getStoredLocation().then(setLocation)
  }, [])

  const categories = useCategories()
  const offers = useOffersList(location, { categoria, raio })

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Ofertas' }} />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: undefined, name: 'Todas' }, ...(categories.data ?? [])]}
        keyExtractor={(item) => item.id ?? 'all'}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, categoria === item.id && styles.chipActive]}
            onPress={() => setCategoria(item.id)}
          >
            <Text style={[styles.chipText, categoria === item.id && styles.chipTextActive]}>{item.name}</Text>
          </Pressable>
        )}
      />
      {location?.type === 'gps' && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ label: 'Toda cidade', value: undefined }, ...RADIUS_OPTIONS.map((km) => ({ label: `Até ${km} km`, value: km }))]}
          keyExtractor={(item) => String(item.value ?? 'all')}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chipSmall, raio === item.value && styles.chipActive]}
              onPress={() => setRaio(item.value)}
            >
              <Text style={[styles.chipText, raio === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      )}
      {offers.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
      <FlatList
        data={offers.data ?? []}
        keyExtractor={(offer) => offer.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <OfferCard offer={item} />
          </View>
        )}
        ListEmptyComponent={
          !offers.isLoading ? <Text style={styles.emptyText}>Nenhuma oferta encontrada com esses filtros.</Text> : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipSmall: { backgroundColor: colors.neutral100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: colors.green },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.neutral900 },
  chipTextActive: { color: colors.white },
  list: { paddingVertical: 8 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
})
```

- [ ] **Step 3: Checar tipos**

Run: `cd app-mobile && npx tsc --noEmit`

- [ ] **Step 4: Verificar manualmente**

Da aba Início, tocar "Ver todas as ofertas" deve abrir esta tela com os filtros de categoria (e de raio, se a localização foi por GPS) funcionando.

- [ ] **Step 5: Commitar**

```bash
git add app-mobile
git commit -m "Add filterable offers list screen"
```

---

### Task 7: Detalhe da oferta + gerar cupom

**Files:**
- Create: `app-mobile/app/oferta/[slug].tsx`
- Create: `app-mobile/src/api/hooks/useOfferDetail.ts`
- Create: `app-mobile/src/components/GenerateCouponButton.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3), `apiFetch`/`OfferDetail` (Task 2), `formatCents` (Task 2).

Sem teste automatizado — verificação manual.

- [ ] **Step 1: Criar o hook de detalhe da oferta**

```typescript
// app-mobile/src/api/hooks/useOfferDetail.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { OfferDetail } from '@/api/types'

export function useOfferDetail(slug: string) {
  return useQuery({
    queryKey: ['oferta', slug],
    queryFn: () => apiFetch<OfferDetail>(`/ofertas/${slug}`),
  })
}
```

- [ ] **Step 2: Criar o componente do botão de gerar cupom**

```tsx
// app-mobile/src/components/GenerateCouponButton.tsx
import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/api/client'

export function GenerateCouponButton({ offerId }: { offerId: string }) {
  const { token, authedFetch } = useAuth()
  const [code, setCode] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePress() {
    if (!token) {
      router.push('/entrar')
      return
    }

    setPending(true)
    setError(null)
    try {
      const result = await authedFetch<{ coupon: { code: string } }>('/cupons/gerar', {
        method: 'POST',
        body: { offerId },
      })
      setCode(result.coupon.code)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o cupom.')
    } finally {
      setPending(false)
    }
  }

  if (code) {
    return (
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Seu código</Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.codeHint}>Mostre este código no estabelecimento</Text>
      </View>
    )
  }

  return (
    <View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handlePress} disabled={pending}>
        {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Gerar cupom</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  error: { color: colors.red, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  codeBox: { backgroundColor: '#E9F9EF', borderRadius: 12, padding: 16, alignItems: 'center' },
  codeLabel: { fontSize: 12, color: colors.neutral500 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 4, color: colors.green },
  codeHint: { fontSize: 12, color: colors.neutral500, marginTop: 4 },
})
```

**Nota:** quando não há token, o botão navega pra `/entrar` (Task 9) em vez de gerar o cupom direto. `/entrar`, depois de logar com sucesso, faz `router.back()` — a pessoa volta pra esta mesma tela de oferta, mas ainda precisa tocar "Gerar cupom" de novo (o token mudou, então desta vez o `if (!token)` é falso e o cupom é gerado). Isso é intencional e simples — evita re-disparar automaticamente uma ação de rede assim que a tela volta ao foco.

- [ ] **Step 3: Criar a tela de detalhe da oferta**

```tsx
// app-mobile/app/oferta/[slug].tsx
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { formatCents } from '@/utils/money'
import { useOfferDetail } from '@/api/hooks/useOfferDetail'
import { GenerateCouponButton } from '@/components/GenerateCouponButton'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function OfertaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: offer, isLoading } = useOfferDetail(slug)

  if (isLoading || !offer) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: offer.business.name }} />
      {offer.imageUrl ? (
        <Image source={{ uri: offer.imageUrl }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}
      <View style={styles.content}>
        <Text style={styles.business}>{offer.business.name}</Text>
        <Text style={styles.title}>{offer.title}</Text>
        {offer.description && <Text style={styles.description}>{offer.description}</Text>}
        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>{formatCents(offer.originalPrice)}</Text>
          <Text style={styles.discountPrice}>{formatCents(offer.discountPrice)}</Text>
        </View>
        <Text style={styles.validUntil}>Válido até {formatDate(offer.endDate)}</Text>
        <View style={styles.buttonWrapper}>
          <GenerateCouponButton offerId={offer.id} />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 220 },
  imagePlaceholder: { width: '100%', height: 220, backgroundColor: colors.neutral100 },
  content: { padding: 16, gap: 8 },
  business: { fontSize: 13, color: colors.neutral500 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  description: { fontSize: 14, color: colors.neutral500, lineHeight: 20 },
  priceRow: { flexDirection: 'row', gap: 10, alignItems: 'baseline', marginTop: 8 },
  originalPrice: { fontSize: 14, color: colors.neutral400, textDecorationLine: 'line-through' },
  discountPrice: { fontSize: 24, fontWeight: '800', color: colors.green },
  validUntil: { fontSize: 12, color: colors.neutral500 },
  buttonWrapper: { marginTop: 16 },
})
```

- [ ] **Step 4: Checar tipos**

Run: `cd app-mobile && npx tsc --noEmit`

- [ ] **Step 5: Verificar manualmente**

Tocar num card de oferta (da Início ou da lista) deve abrir esta tela. Sem login, "Gerar cupom" deve levar pra `/entrar` (que só existe de verdade a partir do Task 9 — até lá, confirme que a navegação ao menos tenta ir pra essa rota sem crashar).

- [ ] **Step 6: Commitar**

```bash
git add app-mobile
git commit -m "Add offer detail screen with coupon generation"
```

---

### Task 8: Detalhe da loja

**Files:**
- Create: `app-mobile/app/loja/[slug].tsx`
- Create: `app-mobile/src/api/hooks/useBusinessDetail.ts`

**Interfaces:**
- Consumes: `OfferCard` (Task 5), `apiFetch`/`BusinessDetail` (Task 2).

Sem teste automatizado — verificação manual.

- [ ] **Step 1: Criar o hook de detalhe da loja**

```typescript
// app-mobile/src/api/hooks/useBusinessDetail.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { BusinessDetail } from '@/api/types'

export function useBusinessDetail(slug: string) {
  return useQuery({
    queryKey: ['loja', slug],
    queryFn: () => apiFetch<BusinessDetail>(`/lojas/${slug}`),
  })
}
```

- [ ] **Step 2: Criar a tela de detalhe da loja**

```tsx
// app-mobile/app/loja/[slug].tsx
import { View, Text, Image, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { colors } from '@/theme/colors'
import { OfferCard } from '@/components/OfferCard'
import { useBusinessDetail } from '@/api/hooks/useBusinessDetail'

export default function LojaScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data: business, isLoading } = useBusinessDetail(slug)

  if (isLoading || !business) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  return (
    <FlatList
      data={business.offers}
      keyExtractor={(offer) => offer.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <Stack.Screen options={{ title: business.name }} />
          {business.coverUrl ? (
            <Image source={{ uri: business.coverUrl }} style={styles.cover} />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View style={styles.header}>
            <Text style={styles.name}>{business.name}</Text>
            <Text style={styles.category}>{business.categoryName}</Text>
            <Text style={styles.location}>{business.city} · {business.state}</Text>
            {business.description && <Text style={styles.description}>{business.description}</Text>}
            <Text style={styles.offersTitle}>Ofertas</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.cardWrapper}>
          <OfferCard offer={item} />
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma oferta ativa no momento.</Text>}
    />
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 24 },
  cover: { width: '100%', height: 140 },
  coverPlaceholder: { width: '100%', height: 140, backgroundColor: colors.neutral100 },
  header: { padding: 16, gap: 4 },
  name: { fontSize: 20, fontWeight: '800', color: colors.neutral900 },
  category: { fontSize: 13, color: colors.green, fontWeight: '600' },
  location: { fontSize: 13, color: colors.neutral500 },
  description: { fontSize: 14, color: colors.neutral500, marginTop: 8, lineHeight: 20 },
  offersTitle: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  cardWrapper: { paddingHorizontal: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 16, paddingHorizontal: 16 },
})
```

- [ ] **Step 3: Checar tipos**

Run: `cd app-mobile && npx tsc --noEmit`

- [ ] **Step 4: Verificar manualmente**

Da tela de detalhe de uma oferta, adicionar temporariamente um link de teste (ou navegar via deep link manual `aki-ofertas-app://loja/<slug>` no simulador) até o Task 9/10 conectarem essa navegação organicamente — confirme que a tela carrega os dados da loja e lista as ofertas dela.

- [ ] **Step 5: Commitar**

```bash
git add app-mobile
git commit -m "Add business detail screen"
```

---

### Task 9: Entrar (Google + e-mail/código)

**Files:**
- Create: `app-mobile/app/entrar.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3), `apiFetch`/`ApiError` (Task 2).

Sem teste automatizado — fluxo de login com permissões/OAuth do sistema, verificação manual. **O botão "Cadastrar com Google" não pode ser testado de ponta a ponta até existir um Client ID real do Google Cloud Console** (pendência já registrada nas Global Constraints deste plano e no plano da API Mobile) — verifique pelo menos que o app não trava ao tocar no botão (o SDK deve retornar um erro tratável, não um crash).

- [ ] **Step 1: Implementar a tela**

```tsx
// app-mobile/app/entrar.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { apiFetch, ApiError } from '@/api/client'

WebBrowser.maybeCompleteAuthSession()

type Step = 'options' | 'email' | 'code'

export default function EntrarScreen() {
  const { login } = useAuth()
  const [step, setStep] = useState<Step>('options')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [needsName, setNeedsName] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  })

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      handleGoogleToken(response.authentication.idToken)
    }
  }, [response])

  async function handleGoogleToken(idToken: string) {
    setPending(true)
    setError(null)
    try {
      const result = await apiFetch<{ token: string; user: { id: string; name: string; email: string } }>(
        '/auth/google',
        { method: 'POST', body: { idToken } },
      )
      await login(result.token, result.user)
      router.back()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar com Google.')
    } finally {
      setPending(false)
    }
  }

  async function handleRequestCode() {
    setPending(true)
    setError(null)
    try {
      await apiFetch('/auth/solicitar-codigo', { method: 'POST', body: { email } })
      setStep('code')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setPending(false)
    }
  }

  async function handleConfirmCode() {
    setPending(true)
    setError(null)
    try {
      const result = await apiFetch<{ token: string; user: { id: string; name: string; email: string } }>(
        '/auth/confirmar-codigo',
        { method: 'POST', body: { email, code, name: name || undefined } },
      )
      await login(result.token, result.user)
      router.back()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível confirmar o código.'
      if (message === 'Informe seu nome.') {
        setNeedsName(true)
        setError(null)
      } else {
        setError(message)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Entrar', presentation: 'modal' }} />

      {step === 'options' && (
        <>
          <Text style={styles.title}>Entrar no Aki Ofertas</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={styles.googleButton} onPress={() => promptAsync()} disabled={!request || pending}>
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.googleButtonText}>Cadastrar com Google</Text>}
          </Pressable>
          <Pressable onPress={() => setStep('email')}>
            <Text style={styles.linkText}>Cadastro normal</Text>
          </Pressable>
        </>
      )}

      {step === 'email' && (
        <>
          <Text style={styles.title}>Digite seu e-mail</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Pressable style={styles.primaryButton} onPress={handleRequestCode} disabled={pending || !email}>
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Enviar código</Text>}
          </Pressable>
        </>
      )}

      {step === 'code' && (
        <>
          <Text style={styles.title}>Digite o código</Text>
          <Text style={styles.subtitle}>Enviamos um código de 6 dígitos para {email}</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TextInput
            style={styles.input}
            placeholder="000000"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          {needsName && (
            <TextInput style={styles.input} placeholder="Seu nome" value={name} onChangeText={setName} />
          )}
          <Pressable style={styles.primaryButton} onPress={handleConfirmCode} disabled={pending || !code}>
            {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Confirmar</Text>}
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.neutral500, textAlign: 'center', marginBottom: 8 },
  error: { color: colors.red, fontSize: 13, textAlign: 'center' },
  googleButton: { backgroundColor: colors.navy, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  googleButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  primaryButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  linkText: { color: colors.neutral500, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
  input: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
})
```

**Nota sobre `needsName`:** o endpoint `/auth/confirmar-codigo` retorna o erro `'Informe seu nome.'` (texto exato já implementado na API mobile) só quando o e-mail é novo e nenhum nome foi mandado. A tela detecta essa mensagem específica pra revelar o campo de nome, em vez de tratar como um erro genérico — isso replica, no app, o mesmo comportamento que a API já implementa (pedir nome só na primeira vez).

- [ ] **Step 2: Checar tipos**

Run: `cd app-mobile && npx tsc --noEmit`

- [ ] **Step 3: Verificar manualmente**

Fluxo de e-mail+código: da tela de oferta, tocar "Gerar cupom" sem estar logado deve abrir `/entrar`; escolher "Cadastro normal", digitar um e-mail real, confirmar que o código chega (isso já depende do `RESEND_API_KEY` estar configurado em produção — se não estiver, a API responde com erro claro em vez de travar, confirme que a tela mostra esse erro corretamente em vez de travar). Se as chaves já estiverem configuradas, complete o fluxo até `router.back()` devolver pra tela de oferta com o token salvo.

- [ ] **Step 4: Commitar**

```bash
git add app-mobile
git commit -m "Add entrar screen with Google and email+code login"
```

---

### Task 10: Cupons e Perfil

**Files:**
- Modify: `app-mobile/app/(tabs)/cupons.tsx`
- Modify: `app-mobile/app/(tabs)/perfil.tsx`
- Create: `app-mobile/src/api/hooks/useCoupons.ts`
- Create: `app-mobile/src/api/hooks/useProfile.ts`

**Interfaces:**
- Consumes: `useAuth` (Task 3), `apiFetch`/`CouponRow`/`Profile` (Task 2).

Sem teste automatizado — verificação manual.

- [ ] **Step 1: Criar os hooks**

```typescript
// app-mobile/src/api/hooks/useCoupons.ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import type { CouponRow } from '@/api/types'

export function useCoupons() {
  const { token, authedFetch } = useAuth()
  return useQuery({
    queryKey: ['cupons'],
    queryFn: () => authedFetch<CouponRow[]>('/cupons'),
    enabled: token !== null,
  })
}
```

```typescript
// app-mobile/src/api/hooks/useProfile.ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import type { Profile } from '@/api/types'

export function useProfile() {
  const { token, authedFetch } = useAuth()
  return useQuery({
    queryKey: ['perfil'],
    queryFn: () => authedFetch<Profile>('/perfil'),
    enabled: token !== null,
  })
}
```

- [ ] **Step 2: Implementar a aba Cupons**

```tsx
// app-mobile/app/(tabs)/cupons.tsx
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useCoupons } from '@/api/hooks/useCoupons'

const STATUS_LABEL: Record<string, string> = { VALID: 'Válido', USED: 'Utilizado', EXPIRED: 'Expirado' }
const STATUS_COLOR: Record<string, string> = { VALID: colors.green, USED: colors.neutral400, EXPIRED: colors.red }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function CuponsScreen() {
  const { token } = useAuth()
  const coupons = useCoupons()

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Entre para ver seus cupons</Text>
        <Pressable style={styles.button} onPress={() => router.push('/entrar')}>
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <FlatList
      data={coupons.data ?? []}
      keyExtractor={(coupon) => coupon.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.title}>Meus cupons</Text>}
      ListEmptyComponent={
        coupons.isLoading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 32 }} />
        ) : (
          <Text style={styles.emptyText}>Você ainda não gerou nenhum cupom.</Text>
        )
      }
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/oferta/${item.offerSlug}`)}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.offerTitle}>{item.offerTitle}</Text>
              <Text style={styles.businessName}>{item.businessName}</Text>
            </View>
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
          </View>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.expiry}>Válido até {formatDate(item.expiresAt)}</Text>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  emptyText: { textAlign: 'center', color: colors.neutral500, marginTop: 32 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: colors.white, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: colors.neutral200, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  offerTitle: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  businessName: { fontSize: 12, color: colors.neutral500 },
  status: { fontSize: 12, fontWeight: '700' },
  code: { fontSize: 20, fontWeight: '800', letterSpacing: 3, textAlign: 'center', marginTop: 12, color: colors.neutral900 },
  expiry: { fontSize: 11, color: colors.neutral500, textAlign: 'center', marginTop: 4 },
})
```

- [ ] **Step 3: Implementar a aba Perfil**

```tsx
// app-mobile/app/(tabs)/perfil.tsx
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/theme/colors'
import { useAuth } from '@/auth/AuthContext'
import { useProfile } from '@/api/hooks/useProfile'

export default function PerfilScreen() {
  const { token, logout } = useAuth()
  const profile = useProfile()

  if (!token) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Entre para ver seu perfil</Text>
        <Pressable style={styles.button} onPress={() => router.push('/entrar')}>
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    )
  }

  if (profile.isLoading || !profile.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.green} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meu perfil</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{profile.data.name}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.value}>{profile.data.email}</Text>
      </View>
      {profile.data.city && (
        <View style={styles.field}>
          <Text style={styles.label}>Cidade</Text>
          <Text style={styles.value}>{profile.data.city}</Text>
        </View>
      )}
      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral900 },
  button: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: colors.white, fontWeight: '700' },
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.neutral900, marginBottom: 8 },
  field: { borderBottomWidth: 1, borderBottomColor: colors.neutral200, paddingBottom: 12 },
  label: { fontSize: 12, color: colors.neutral500 },
  value: { fontSize: 15, color: colors.neutral900, marginTop: 2 },
  logoutButton: { marginTop: 24, alignItems: 'center' },
  logoutText: { color: colors.red, fontWeight: '700' },
})
```

- [ ] **Step 4: Checar tipos, rodar a suíte completa**

Run: `cd app-mobile && npx tsc --noEmit && npx jest`
Expected: sem erros; suíte completa passando (13 testes: 9 de `client.test.ts`/`money.test.ts` do Task 2 + 4 de `location.test.ts` do Task 3)

- [ ] **Step 5: Verificar manualmente**

Sem login: as abas Cupons e Perfil mostram o convite pra entrar. Depois de logar (Task 9), Cupons lista os cupons gerados e Perfil mostra nome/e-mail/cidade, com o botão "Sair" limpando a sessão e voltando ao estado deslogado.

- [ ] **Step 6: Commitar**

```bash
git add app-mobile
git commit -m "Add Cupons and Perfil tabs"
```
