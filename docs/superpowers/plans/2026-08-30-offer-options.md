# Sabores, Bordas e Adicionais nas Ofertas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comerciante configura grupos de opções (sabor, borda, adicionais) por oferta; cliente escolhe entre elas ao pedir aquela oferta com entrega, com o preço extra somando no total.

**Architecture:** Dois modelos novos (`OfferOptionGroup`, `OfferOptionChoice`) ligados à `Offer`. CRUD no painel do comerciante (server actions + componente de gerenciamento). `OfferDetail` passa a expor os grupos pro cliente. `createOrderForUser` valida a seleção e grava um snapshot textual + o valor extra no `Order`. Painel de pedidos e telas do app mostram o snapshot e somam o valor no total.

**Tech Stack:** Next.js 14 (App Router, Server Actions, Route Handlers), Prisma/Postgres, Vitest; Expo Router / React Native.

## Global Constraints

- Grupos são genéricos (nome livre, tipo única/múltipla escolha, obrigatório ou não) — nada hardcoded por tipo de comida.
- A escolha vale pra toda a quantidade do pedido (não por unidade) — decisão confirmada, não reabrir.
- `optionsFeeCents` no `Order` é a soma dos `extraPriceCents` das escolhas selecionadas, **multiplicada pela quantidade**.
- `selectedOptions`/`optionsFeeCents` são snapshot no `Order` — mudar/excluir grupos e escolhas depois não altera pedidos já feitos.
- Autorização das novas server actions usa `requireMerchantBusiness()` (já existe em `src/actions/offer-actions.ts`), mesmo padrão do resto do painel — cada ação confere que a oferta (via o grupo, no caso de escolha) pertence ao negócio autenticado.
- `input.selectedChoiceIds` é **opcional** em `CreateOrderInput`/no corpo da API — ofertas sem nenhum grupo continuam funcionando exatamente como hoje, sem exigir esse campo.

---

### Task 1: Schema — grupos e escolhas de opção, snapshot no pedido

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `enum OfferOptionGroupType { SINGLE MULTIPLE }`
- Produces: `OfferOptionGroup { id, offerId, offer, name, type, required, order, choices }`, `@@map("offer_option_groups")`.
- Produces: `OfferOptionChoice { id, groupId, group, name, extraPriceCents, order }`, `@@map("offer_option_choices")`.
- Produces: `Offer.optionGroups OfferOptionGroup[]`.
- Produces: `Order.selectedOptions String?`, `Order.optionsFeeCents Int?`.

- [ ] **Step 1: Adicionar o enum e os dois modelos novos**

Em `prisma/schema.prisma`, perto dos outros `enum`s (junto de `CouponStatus`/`OrderStatus`):

```prisma
enum OfferOptionGroupType {
  SINGLE
  MULTIPLE
}
```

Logo após o modelo `Offer`:

```prisma
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

- [ ] **Step 2: Ligar `Offer` ao novo modelo**

No modelo `Offer`, no bloco de relações (perto de `coupons Coupon[]`), adicionar:

```prisma
  optionGroups OfferOptionGroup[]
```

- [ ] **Step 3: Adicionar os campos snapshot em `Order`**

No modelo `Order`, logo abaixo de `deliveryFeeCents`, adicionar:

```prisma
  selectedOptions String?
  optionsFeeCents Int?
```

- [ ] **Step 4: Gerar e aplicar a migration, gerar o client**

```bash
npx prisma migrate dev --name add_offer_options
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add offer customization option groups/choices and order snapshot fields"
```

---

### Task 2: Server actions — CRUD de grupos e escolhas

**Files:**
- Create: `src/actions/offer-option-actions.ts`
- Create: `src/actions/__tests__/offer-option-actions.test.ts`

**Interfaces:**
- Consumes: `requireMerchantBusiness()` de `src/actions/offer-actions.ts`; `reaisToCents`/`centsToReais` de `src/lib/money.ts`.
- Produces: `createOptionGroup(input: { offerId: string; name: string; type: 'SINGLE' | 'MULTIPLE'; required: boolean }): Promise<{ ok: true; groupId: string } | { ok: false; error: string }>`
- Produces: `deleteOptionGroup(groupId: string): Promise<{ ok: true } | { ok: false; error: string }>`
- Produces: `createOptionChoice(input: { groupId: string; name: string; extraPriceCents: string }): Promise<{ ok: true; choiceId: string } | { ok: false; error: string }>`
- Produces: `deleteOptionChoice(choiceId: string): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Criar `src/actions/offer-option-actions.ts`**

```ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { reaisToCents } from '@/lib/money'

const groupSchema = z.object({
  offerId: z.string().min(1),
  name: z.string().min(2, 'Informe o nome do grupo.'),
  type: z.enum(['SINGLE', 'MULTIPLE']),
  required: z.boolean(),
})

type GroupInput = z.infer<typeof groupSchema>
type GroupResult = { ok: true; groupId: string } | { ok: false; error: string }

export async function createOptionGroup(input: GroupInput): Promise<GroupResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const offer = await prisma.offer.findFirst({ where: { id: parsed.data.offerId, businessId: business.id } })
  if (!offer) {
    return { ok: false, error: 'Oferta não encontrada.' }
  }

  const group = await prisma.offerOptionGroup.create({
    data: {
      offerId: offer.id,
      name: parsed.data.name,
      type: parsed.data.type,
      required: parsed.data.required,
    },
  })

  return { ok: true, groupId: group.id }
}

export async function deleteOptionGroup(groupId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const group = await prisma.offerOptionGroup.findFirst({
    where: { id: groupId, offer: { businessId: business.id } },
  })
  if (!group) {
    return { ok: false, error: 'Grupo não encontrado.' }
  }

  await prisma.offerOptionGroup.delete({ where: { id: groupId } })
  return { ok: true }
}

const choiceSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1, 'Informe o nome da opção.'),
  extraPriceCents: z.string().optional(),
})

type ChoiceInput = z.infer<typeof choiceSchema>
type ChoiceResult = { ok: true; choiceId: string } | { ok: false; error: string }

export async function createOptionChoice(input: ChoiceInput): Promise<ChoiceResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = choiceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const group = await prisma.offerOptionGroup.findFirst({
    where: { id: parsed.data.groupId, offer: { businessId: business.id } },
  })
  if (!group) {
    return { ok: false, error: 'Grupo não encontrado.' }
  }

  let extraPriceCents = 0
  if (parsed.data.extraPriceCents && parsed.data.extraPriceCents.trim()) {
    const parsedPrice = reaisToCents(parsed.data.extraPriceCents)
    if (parsedPrice === null || parsedPrice < 0) {
      return { ok: false, error: 'Informe um preço extra válido.' }
    }
    extraPriceCents = parsedPrice
  }

  const choice = await prisma.offerOptionChoice.create({
    data: { groupId: group.id, name: parsed.data.name, extraPriceCents },
  })

  return { ok: true, choiceId: choice.id }
}

export async function deleteOptionChoice(choiceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const choice = await prisma.offerOptionChoice.findFirst({
    where: { id: choiceId, group: { offer: { businessId: business.id } } },
  })
  if (!choice) {
    return { ok: false, error: 'Opção não encontrada.' }
  }

  await prisma.offerOptionChoice.delete({ where: { id: choiceId } })
  return { ok: true }
}
```

- [ ] **Step 2: Testes em `src/actions/__tests__/offer-option-actions.test.ts`**

Mesmo padrão de `src/actions/__tests__/delivery-zone-actions.test.ts` (mock de `@/actions/offer-actions` e `@/lib/db`):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOptionGroup, deleteOptionGroup, createOptionChoice, deleteOptionChoice } from '@/actions/offer-option-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    offer: { findFirst: vi.fn() },
    offerOptionGroup: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    offerOptionChoice: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}))

const business = { id: 'biz-1' }

describe('createOptionGroup', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await createOptionGroup({ offerId: 'offer-1', name: 'Sabor', type: 'SINGLE', required: true })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the offer does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null)

    const result = await createOptionGroup({ offerId: 'offer-of-another-biz', name: 'Sabor', type: 'SINGLE', required: true })
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
    expect(prisma.offerOptionGroup.create).not.toHaveBeenCalled()
  })

  it('creates the group', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.offerOptionGroup.create).mockResolvedValue({ id: 'group-1' } as never)

    const result = await createOptionGroup({ offerId: 'offer-1', name: 'Sabor', type: 'SINGLE', required: true })

    expect(result).toEqual({ ok: true, groupId: 'group-1' })
    expect(prisma.offerOptionGroup.create).toHaveBeenCalledWith({
      data: { offerId: 'offer-1', name: 'Sabor', type: 'SINGLE', required: true },
    })
  })
})

describe('deleteOptionGroup', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects deleting a group from another business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue(null)

    const result = await deleteOptionGroup('group-1')
    expect(result).toEqual({ ok: false, error: 'Grupo não encontrado.' })
    expect(prisma.offerOptionGroup.delete).not.toHaveBeenCalled()
  })

  it('deletes a group owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue({ id: 'group-1' } as never)

    const result = await deleteOptionGroup('group-1')
    expect(result).toEqual({ ok: true })
    expect(prisma.offerOptionGroup.delete).toHaveBeenCalledWith({ where: { id: 'group-1' } })
  })
})

describe('createOptionChoice', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the group does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue(null)

    const result = await createOptionChoice({ groupId: 'group-of-another-biz', name: 'Calabresa' })
    expect(result).toEqual({ ok: false, error: 'Grupo não encontrado.' })
  })

  it('creates a choice with zero extra price when none is given', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue({ id: 'group-1' } as never)
    vi.mocked(prisma.offerOptionChoice.create).mockResolvedValue({ id: 'choice-1' } as never)

    const result = await createOptionChoice({ groupId: 'group-1', name: 'Calabresa' })

    expect(result).toEqual({ ok: true, choiceId: 'choice-1' })
    expect(prisma.offerOptionChoice.create).toHaveBeenCalledWith({
      data: { groupId: 'group-1', name: 'Calabresa', extraPriceCents: 0 },
    })
  })

  it('creates a choice with a given extra price', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue({ id: 'group-1' } as never)
    vi.mocked(prisma.offerOptionChoice.create).mockResolvedValue({ id: 'choice-1' } as never)

    const result = await createOptionChoice({ groupId: 'group-1', name: 'Bacon', extraPriceCents: '3.00' })

    expect(result).toEqual({ ok: true, choiceId: 'choice-1' })
    expect(prisma.offerOptionChoice.create).toHaveBeenCalledWith({
      data: { groupId: 'group-1', name: 'Bacon', extraPriceCents: 300 },
    })
  })
})

describe('deleteOptionChoice', () => {
  afterEach(() => vi.clearAllMocks())

  it('deletes a choice owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionChoice.findFirst).mockResolvedValue({ id: 'choice-1' } as never)

    const result = await deleteOptionChoice('choice-1')
    expect(result).toEqual({ ok: true })
    expect(prisma.offerOptionChoice.delete).toHaveBeenCalledWith({ where: { id: 'choice-1' } })
  })
})
```

- [ ] **Step 3: Rodar os testes**

```bash
npx vitest run src/actions/__tests__/offer-option-actions.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/offer-option-actions.ts src/actions/__tests__/offer-option-actions.test.ts
git commit -m "feat: server actions for offer option group/choice CRUD"
```

---

### Task 3: Painel do comerciante — gerenciar opções na tela de editar oferta

**Files:**
- Create: `src/components/merchant/OfferOptionsManager.tsx`
- Modify: `src/app/comerciante/ofertas/[id]/page.tsx`
- Modify: `src/lib/merchant.ts`

**Interfaces:**
- Consumes: `createOptionGroup`, `deleteOptionGroup`, `createOptionChoice`, `deleteOptionChoice` de `src/actions/offer-option-actions.ts` (Task 2).
- Produces: `getOfferOptionGroupsForOwner(offerId: string)` em `src/lib/merchant.ts`.

- [ ] **Step 1: Adicionar `getOfferOptionGroupsForOwner` em `src/lib/merchant.ts`**

```ts
export async function getOfferOptionGroupsForOwner(offerId: string) {
  return prisma.offerOptionGroup.findMany({
    where: { offerId },
    include: { choices: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })
}
```

- [ ] **Step 2: Criar `src/components/merchant/OfferOptionsManager.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOptionGroup, deleteOptionGroup, createOptionChoice, deleteOptionChoice } from '@/actions/offer-option-actions'
import { centsToReais } from '@/lib/money'

type Choice = { id: string; name: string; extraPriceCents: number }
type Group = { id: string; name: string; type: 'SINGLE' | 'MULTIPLE'; required: boolean; choices: Choice[] }

export function OfferOptionsManager({ offerId, groups }: { offerId: string; groups: Group[] }) {
  const router = useRouter()
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState<'SINGLE' | 'MULTIPLE'>('SINGLE')
  const [groupRequired, setGroupRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [choiceForms, setChoiceForms] = useState<Record<string, { name: string; price: string }>>({})

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const result = await createOptionGroup({ offerId, name: groupName, type: groupType, required: groupRequired })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setGroupName('')
      setGroupType('SINGLE')
      setGroupRequired(false)
      setShowGroupForm(false)
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!window.confirm('Remover este grupo e todas as opções dele?')) return
    await deleteOptionGroup(groupId)
    router.refresh()
  }

  function updateChoiceForm(groupId: string, field: 'name' | 'price', value: string) {
    setChoiceForms((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] ?? { name: '', price: '' }), [field]: value } }))
  }

  async function handleAddChoice(groupId: string) {
    const form = choiceForms[groupId] ?? { name: '', price: '' }
    if (!form.name.trim()) return
    setError(null)
    try {
      const result = await createOptionChoice({ groupId, name: form.name, extraPriceCents: form.price || undefined })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setChoiceForms((prev) => ({ ...prev, [groupId]: { name: '', price: '' } }))
      router.refresh()
    } catch {
      setError('Algo deu errado. Tente novamente.')
    }
  }

  async function handleDeleteChoice(choiceId: string) {
    await deleteOptionChoice(choiceId)
    router.refresh()
  }

  const inputClass = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-900">Opções de personalização</h2>
        {!showGroupForm && (
          <button
            type="button"
            onClick={() => setShowGroupForm(true)}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-bold text-white"
          >
            + Novo grupo
          </button>
        )}
      </div>

      {showGroupForm && (
        <form onSubmit={handleAddGroup} className="flex max-w-sm flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Nome do grupo (ex: Sabor, Borda, Adicionais)
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className={inputClass} required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Tipo
            <select value={groupType} onChange={(e) => setGroupType(e.target.value as 'SINGLE' | 'MULTIPLE')} className={inputClass}>
              <option value="SINGLE">Escolha única</option>
              <option value="MULTIPLE">Múltipla escolha</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input type="checkbox" checked={groupRequired} onChange={(e) => setGroupRequired(e.target.checked)} />
            Obrigatório
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
            >
              {saving ? 'Salvando...' : 'Adicionar grupo'}
            </button>
            <button type="button" onClick={() => setShowGroupForm(false)} className="text-sm font-bold text-neutral-500">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum grupo de opção cadastrado ainda.</p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-900">
                {group.name}{' '}
                <span className="font-normal text-neutral-400">
                  ({group.type === 'SINGLE' ? 'única escolha' : 'múltipla escolha'}
                  {group.required ? ', obrigatório' : ''})
                </span>
              </p>
              <button type="button" onClick={() => handleDeleteGroup(group.id)} className="text-xs font-bold text-red-600">
                Remover grupo
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {group.choices.map((choice) => (
                <div key={choice.id} className="flex items-center justify-between text-sm text-neutral-600">
                  <span>
                    {choice.name}
                    {choice.extraPriceCents > 0 ? ` (+R$ ${centsToReais(choice.extraPriceCents)})` : ''}
                  </span>
                  <button type="button" onClick={() => handleDeleteChoice(choice.id)} className="text-xs font-bold text-red-600">
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                placeholder="Nome da opção"
                value={choiceForms[group.id]?.name ?? ''}
                onChange={(e) => updateChoiceForm(group.id, 'name', e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <input
                placeholder="Preço extra (R$)"
                value={choiceForms[group.id]?.price ?? ''}
                onChange={(e) => updateChoiceForm(group.id, 'price', e.target.value)}
                className={`${inputClass} w-32`}
              />
              <button
                type="button"
                onClick={() => handleAddChoice(group.id)}
                className="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 3: Atualizar `src/app/comerciante/ofertas/[id]/page.tsx`**

Ler o arquivo primeiro. Adicionar os imports de `getOfferOptionGroupsForOwner` e `OfferOptionsManager`, buscar os grupos, e renderizar o componente abaixo do `<OfferForm>` já existente:

```tsx
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveCategories } from '@/lib/categories'
import { getBusinessForOwner, getOfferForOwner, getOfferOptionGroupsForOwner } from '@/lib/merchant'
import { centsToReais } from '@/lib/money'
import { OfferForm } from '@/components/merchant/OfferForm'
import { OfferOptionsManager } from '@/components/merchant/OfferOptionsManager'

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function EditarOfertaPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  if (!business) {
    notFound()
  }

  const offer = await getOfferForOwner(params.id, business.id)
  if (!offer) {
    notFound()
  }

  const categories = await getActiveCategories()
  const optionGroups = await getOfferOptionGroupsForOwner(offer.id)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar oferta</h1>
      <OfferForm
        categories={categories}
        offerId={offer.id}
        initialValues={{
          title: offer.title,
          description: offer.description ?? '',
          imageUrl: offer.imageUrl ?? '',
          originalPrice: centsToReais(offer.originalPrice),
          discountPrice: centsToReais(offer.discountPrice),
          categoryId: offer.categoryId,
          quantityAvailable: offer.quantityAvailable !== null ? String(offer.quantityAvailable) : '',
          startDate: toDateInputValue(offer.startDate),
          endDate: toDateInputValue(offer.endDate),
          deliveryEnabled: offer.deliveryEnabled,
          customCouponCode: offer.customCouponCode ?? '',
        }}
      />
      <OfferOptionsManager offerId={offer.id} groups={optionGroups} />
    </div>
  )
}
```

- [ ] **Step 4: Verificar tipos e build**

```bash
npx tsc --noEmit
npm run build
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant/OfferOptionsManager.tsx src/app/comerciante/ofertas/\[id\]/page.tsx src/lib/merchant.ts
git commit -m "feat: manage offer customization options from the edit-offer page"
```

---

### Task 4: `lib/offers.ts` expõe os grupos de opção

**Files:**
- Modify: `src/lib/offers.ts`
- Modify: `src/lib/__tests__/offers.test.ts`

**Interfaces:**
- Produces: `OfferDetail.optionGroups: { id: string; name: string; type: 'SINGLE' | 'MULTIPLE'; required: boolean; choices: { id: string; name: string; extraPriceCents: number }[] }[]`.

- [ ] **Step 1: Atualizar o tipo `OfferDetail` em `src/lib/offers.ts`**

Ler o arquivo primeiro (o tipo já tem `deliveryZones` de uma feature anterior — adicionar `optionGroups` junto, por volta da linha 138-160):

```ts
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
  startDate: Date
  endDate: Date
  deliveryEnabled: boolean
  deliveryZones: { id: string; neighborhood: string; feeCents: number }[]
  optionGroups: {
    id: string
    name: string
    type: 'SINGLE' | 'MULTIPLE'
    required: boolean
    choices: { id: string; name: string; extraPriceCents: number }[]
  }[]
  business: {
    id: string
    name: string
    slug: string
    whatsapp: string | null
    city: string
    state: string
  }
}
```

- [ ] **Step 2: Atualizar `getOfferBySlug` pra buscar e mapear os grupos**

Ler a função atual (por volta da linha 162-200). Adicionar `optionGroups: { include: { choices: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }` ao `include` do `prisma.offer.findUnique` (como irmão de `business`, não dentro dele — `optionGroups` é relação direta da própria `Offer`), e adicionar o campo mapeado no retorno:

```ts
export async function getOfferBySlug(slug: string): Promise<OfferDetail | null> {
  const row = await prisma.offer.findUnique({
    where: { slug },
    include: {
      business: {
        include: {
          owner: { select: { blocked: true } },
          deliveryZones: { where: { active: true }, orderBy: { neighborhood: 'asc' } },
        },
      },
      optionGroups: {
        include: { choices: { orderBy: [{ order: 'asc' }, { name: 'asc' }] } },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      },
    },
  })

  if (!row) return null
  if (row.business.status !== 'ACTIVE' || row.business.owner.blocked) return null

  const now = new Date()
  if (row.startDate > now || row.endDate < now) return null

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    originalPrice: row.originalPrice,
    discountPrice: row.discountPrice,
    discountPercent: row.discountPercent,
    quantityAvailable: row.quantityAvailable,
    startDate: row.startDate,
    endDate: row.endDate,
    deliveryEnabled: row.deliveryEnabled,
    deliveryZones: row.business.deliveryZones.map((zone) => ({
      id: zone.id,
      neighborhood: zone.neighborhood,
      feeCents: zone.feeCents,
    })),
    optionGroups: row.optionGroups.map((group) => ({
      id: group.id,
      name: group.name,
      type: group.type,
      required: group.required,
      choices: group.choices.map((choice) => ({
        id: choice.id,
        name: choice.name,
        extraPriceCents: choice.extraPriceCents,
      })),
    })),
    business: {
      id: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
      whatsapp: row.business.whatsapp,
      city: row.business.city,
      state: row.business.state,
    },
  }
}
```

(A parte de `deliveryZones` já existente no `return` não muda — só está reproduzida acima como referência de onde `optionGroups` entra ao lado dela.)

- [ ] **Step 3: Atualizar/criar o teste de `getOfferBySlug`**

Ler `src/lib/__tests__/offers.test.ts` primeiro pra localizar o fixture de oferta ativa já usado pro teste de `getOfferBySlug` (o mesmo que já ganhou `deliveryZones` numa feature anterior). Adicionar `optionGroups: []` a esse fixture base (preservando os testes existentes sem mudança de comportamento), e um novo teste:

```ts
it('includes option groups with their choices, mapped correctly', async () => {
  vi.mocked(prisma.offer.findUnique).mockResolvedValue({
    // ...demais campos do fixture existente da oferta ativa, com deliveryZones: []...
    optionGroups: [
      {
        id: 'group-1',
        name: 'Sabor',
        type: 'SINGLE',
        required: true,
        choices: [{ id: 'choice-1', name: 'Calabresa', extraPriceCents: 0 }],
      },
    ],
  } as never)

  const result = await getOfferBySlug('combo-burguer')

  expect(result?.optionGroups).toEqual([
    {
      id: 'group-1',
      name: 'Sabor',
      type: 'SINGLE',
      required: true,
      choices: [{ id: 'choice-1', name: 'Calabresa', extraPriceCents: 0 }],
    },
  ])
})
```

(Montar o fixture completo reaproveitando exatamente o que o teste de `deliveryZones` já usa como base — não recriar os outros campos do zero.)

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/offers.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/offers.ts src/lib/__tests__/offers.test.ts
git commit -m "feat: expose offer option groups and choices on offer detail"
```

---

### Task 5: `createOrderForUser` valida e calcula as opções escolhidas

**Files:**
- Modify: `src/lib/orders.ts`
- Modify: `src/lib/__tests__/orders.test.ts`
- Modify: `src/app/api/mobile/pedidos/route.ts`
- Modify: `src/app/api/mobile/pedidos/__tests__/pedidos.test.ts`

**Interfaces:**
- Produces: `CreateOrderInput.selectedChoiceIds?: string[]` (opcional).
- Produces: novos erros `'Escolha uma opção para {nome}.'`, `'Escolha apenas uma opção para {nome}.'`, `'Opção inválida.'`.

- [ ] **Step 1: Atualizar `CreateOrderInput` e `createOrderForUser` em `src/lib/orders.ts`**

Ler o arquivo primeiro (a função atual já valida `deliveryZoneId` — ver conteúdo já reproduzido no plano de "Taxa de Entrega por Bairro" se precisar de referência do formato exato; ler o arquivo real antes de editar). Adicionar `selectedChoiceIds?: string[]` ao tipo `CreateOrderInput`.

No `prisma.offer.findUnique` já existente (que busca a oferta antes de validar), adicionar `optionGroups: { include: { choices: true } }` ao `include`.

Logo depois da validação da `deliveryZone` (`if (!zone) { return ... }`) e antes do `prisma.order.create`, adicionar:

```ts
  const selectedChoiceIds = input.selectedChoiceIds ?? []
  const allChoices = offer.optionGroups.flatMap((group) => group.choices)
  const validChoiceIds = new Set(allChoices.map((choice) => choice.id))
  if (selectedChoiceIds.some((id) => !validChoiceIds.has(id))) {
    return { ok: false, error: 'Opção inválida.' }
  }

  let optionsFeeCents = 0
  const summaryParts: string[] = []
  for (const group of offer.optionGroups) {
    const selectedInGroup = group.choices.filter((choice) => selectedChoiceIds.includes(choice.id))

    if (group.required && selectedInGroup.length === 0) {
      return { ok: false, error: `Escolha uma opção para ${group.name}.` }
    }
    if (group.type === 'SINGLE' && selectedInGroup.length > 1) {
      return { ok: false, error: `Escolha apenas uma opção para ${group.name}.` }
    }
    if (selectedInGroup.length > 0) {
      optionsFeeCents += selectedInGroup.reduce((sum, choice) => sum + choice.extraPriceCents, 0)
      summaryParts.push(`${group.name}: ${selectedInGroup.map((choice) => choice.name).join(', ')}`)
    }
  }
  optionsFeeCents *= input.quantity
  const selectedOptionsSummary = summaryParts.length > 0 ? summaryParts.join(' · ') : null
```

No `prisma.order.create`, adicionar ao `data`:

```ts
      selectedOptions: selectedOptionsSummary,
      optionsFeeCents: offer.optionGroups.length > 0 ? optionsFeeCents : null,
```

- [ ] **Step 2: Atualizar `src/lib/__tests__/orders.test.ts`**

Ler o arquivo primeiro. Adicionar `optionGroups: []` ao fixture `activeOffer` já existente (preserva os testes atuais sem mudança). Atualizar o teste `'creates the order, uppercasing the state'`: adicionar `selectedOptions: null, optionsFeeCents: null` ao objeto `data` esperado em `expect(prisma.order.create).toHaveBeenCalledWith(...)`.

Adicionar novos testes:

```ts
const offerWithOptions = {
  ...activeOffer,
  optionGroups: [
    {
      id: 'group-1',
      name: 'Sabor',
      type: 'SINGLE',
      required: true,
      choices: [
        { id: 'choice-1', name: 'Calabresa', extraPriceCents: 0 },
        { id: 'choice-2', name: 'Portuguesa', extraPriceCents: 0 },
      ],
    },
    {
      id: 'group-2',
      name: 'Adicionais',
      type: 'MULTIPLE',
      required: false,
      choices: [
        { id: 'choice-3', name: 'Bacon', extraPriceCents: 300 },
        { id: 'choice-4', name: 'Cheddar', extraPriceCents: 200 },
      ],
    },
  ],
}

it('rejects when a required option group has no selection', async () => {
  vi.mocked(prisma.offer.findUnique).mockResolvedValue(offerWithOptions as never)
  vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', neighborhood: 'Centro', feeCents: 500 } as never)

  const result = await createOrderForUser('user-1', { ...validInput, selectedChoiceIds: [] })
  expect(result).toEqual({ ok: false, error: 'Escolha uma opção para Sabor.' })
  expect(prisma.order.create).not.toHaveBeenCalled()
})

it('rejects when a single-choice group has more than one selection', async () => {
  vi.mocked(prisma.offer.findUnique).mockResolvedValue(offerWithOptions as never)
  vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', neighborhood: 'Centro', feeCents: 500 } as never)

  const result = await createOrderForUser('user-1', { ...validInput, selectedChoiceIds: ['choice-1', 'choice-2'] })
  expect(result).toEqual({ ok: false, error: 'Escolha apenas uma opção para Sabor.' })
})

it('rejects a choice id that does not belong to this offer', async () => {
  vi.mocked(prisma.offer.findUnique).mockResolvedValue(offerWithOptions as never)
  vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', neighborhood: 'Centro', feeCents: 500 } as never)

  const result = await createOrderForUser('user-1', { ...validInput, selectedChoiceIds: ['choice-from-another-offer'] })
  expect(result).toEqual({ ok: false, error: 'Opção inválida.' })
})

it('computes the options fee multiplied by quantity and the summary text', async () => {
  vi.mocked(prisma.offer.findUnique).mockResolvedValue(offerWithOptions as never)
  vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', neighborhood: 'Centro', feeCents: 500 } as never)
  vi.mocked(prisma.order.create).mockResolvedValue({ id: 'order-1', user: { name: 'Maria' } } as never)

  const result = await createOrderForUser('user-1', {
    ...validInput,
    quantity: 2,
    selectedChoiceIds: ['choice-1', 'choice-3', 'choice-4'],
  })

  expect(result).toEqual({ ok: true, orderId: 'order-1' })
  expect(prisma.order.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        selectedOptions: 'Sabor: Calabresa · Adicionais: Bacon, Cheddar',
        optionsFeeCents: 1000,
      }),
    }),
  )
})
```

- [ ] **Step 3: Atualizar `src/app/api/mobile/pedidos/route.ts`**

Ler o arquivo primeiro. Adicionar `selectedChoiceIds: z.array(z.string()).optional(),` ao `bodySchema`.

- [ ] **Step 4: Atualizar `src/app/api/mobile/pedidos/__tests__/pedidos.test.ts`**

Ler o arquivo primeiro. Nenhuma mudança de comportamento é necessária nos testes já existentes (o campo é opcional) — conferir que continuam passando.

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/lib/__tests__/orders.test.ts src/app/api/mobile/pedidos/__tests__/pedidos.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/orders.ts src/lib/__tests__/orders.test.ts src/app/api/mobile/pedidos
git commit -m "feat: validate and price selected offer options when creating a delivery order"
```

---

### Task 6: Exibir as opções no painel do comerciante

**Files:**
- Modify: `src/components/merchant/OrderManager.tsx`
- Modify: `src/app/comerciante/pedidos/[id]/imprimir/page.tsx`
- Modify: `src/lib/orders.ts`

**Interfaces:**
- Produces: `OrderRow.selectedOptions: string | null`, `OrderRow.optionsFeeCents: number | null`.

- [ ] **Step 1: Adicionar os dois campos em `OrderRow`/`toOrderRow` em `src/lib/orders.ts`**

Ler o arquivo primeiro (mesmo arquivo da Task 5 — `deliveryFeeCents` já segue exatamente esse padrão de campo simples passado direto). Adicionar `selectedOptions: string | null` e `optionsFeeCents: number | null` ao tipo `OrderRow`, ao parâmetro de `toOrderRow`, e ao objeto retornado por `toOrderRow`.

- [ ] **Step 2: Atualizar `src/lib/__tests__/orders.test.ts`**

Adicionar `selectedOptions: null, optionsFeeCents: null` ao `orderRowFixture` e às expectativas de `getOrdersForUser`/quaisquer outras que comparem o objeto completo (ler o arquivo pra localizar todas).

- [ ] **Step 3: Atualizar `src/components/merchant/OrderManager.tsx`**

Ler o arquivo primeiro (por volta da linha 141-157, onde já mostra `Taxa de entrega`/`Total`/`Obs`). Adicionar uma linha "Opções" quando `order.selectedOptions` não for nulo, e corrigir o `Total` pra somar `optionsFeeCents`:

```tsx
            {order.selectedOptions && <p className="col-span-2">Opções: {order.selectedOptions}</p>}
```
(inserir junto das outras linhas do `<div className="mt-3 grid grid-cols-2 gap-2 ...">`, antes ou depois de `Obs`, seguindo a mesma estrutura). Trocar a fórmula do `Total`:

```tsx
            <p className="font-bold">
              Total: R$ {centsToReais(order.discountPrice * order.quantity + (order.deliveryFeeCents ?? 0) + (order.optionsFeeCents ?? 0))}
            </p>
```

- [ ] **Step 4: Atualizar `src/app/comerciante/pedidos/[id]/imprimir/page.tsx`**

Mesma mudança de fórmula do total, e uma linha "Opções: {order.selectedOptions}" quando não nulo (mesmo padrão da linha "Obs:" já existente).

- [ ] **Step 5: Rodar os testes e verificar build**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/orders.ts src/lib/__tests__/orders.test.ts src/components/merchant/OrderManager.tsx src/app/comerciante/pedidos
git commit -m "feat: show selected offer options and their cost in the merchant order views"
```

---

### Task 7: App mobile — escolher as opções na tela de pedido

**Files:**
- Modify: `app-mobile/src/api/types.ts`
- Modify: `app-mobile/app/pedido/[slug].tsx`

**Interfaces:**
- Produces: `OfferDetail.optionGroups` (mesmo shape do site), `CreateOrderInput.selectedChoiceIds?: string[]`, `OrderRow.optionsFeeCents: number | null`.

- [ ] **Step 1: Atualizar `app-mobile/src/api/types.ts`**

Ler o arquivo primeiro. No tipo `OfferDetail`, adicionar `optionGroups`:

```ts
  optionGroups: {
    id: string
    name: string
    type: 'SINGLE' | 'MULTIPLE'
    required: boolean
    choices: { id: string; name: string; extraPriceCents: number }[]
  }[]
```

No tipo `CreateOrderInput`, adicionar `selectedChoiceIds?: string[]`. No tipo `OrderRow`, adicionar `optionsFeeCents: number | null` (junto de `deliveryFeeCents`, já existente).

- [ ] **Step 2: Atualizar `app-mobile/app/pedido/[slug].tsx`**

Ler o arquivo por inteiro primeiro (já tem o fluxo de bairro/CEP de features anteriores). Adicionar estado novo:

```ts
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([])
```

Função pra alternar uma escolha, tratando única/múltipla escolha:

```ts
  function toggleChoice(group: { id: string; type: 'SINGLE' | 'MULTIPLE'; choices: { id: string }[] }, choiceId: string) {
    setSelectedChoiceIds((prev) => {
      const groupChoiceIds = new Set(group.choices.map((c) => c.id))
      const withoutGroup = prev.filter((id) => !groupChoiceIds.has(id))
      if (group.type === 'SINGLE') {
        return prev.includes(choiceId) ? withoutGroup : [...withoutGroup, choiceId]
      }
      return prev.includes(choiceId) ? prev.filter((id) => id !== choiceId) : [...prev, choiceId]
    })
  }
```

No JSX, logo antes da seção "Bairro" já existente, se `offer.optionGroups.length > 0`:

```tsx
      {offer.optionGroups.map((group) => (
        <View key={group.id} style={{ gap: 6 }}>
          <Text style={styles.label}>
            {group.name}
            {group.required ? ' *' : ''}
          </Text>
          <View style={styles.zoneList}>
            {group.choices.map((choice) => {
              const selected = selectedChoiceIds.includes(choice.id)
              return (
                <Pressable
                  key={choice.id}
                  style={[styles.zoneOption, selected && styles.zoneOptionSelected]}
                  onPress={() => toggleChoice(group, choice.id)}
                >
                  <Text style={[styles.zoneOptionText, selected && styles.zoneOptionTextSelected]}>
                    {choice.name}
                    {choice.extraPriceCents > 0 ? ` (+${formatCents(choice.extraPriceCents)})` : ''}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
```

(Reaproveita os estilos `zoneList`/`zoneOption`/`zoneOptionSelected`/`zoneOptionText`/`zoneOptionTextSelected` já existentes no arquivo — não criar estilos novos pra isso.)

Calcular o valor extra e somar no total. Onde hoje é:

```ts
  const subtotal = offer.discountPrice * quantity
  const total = calculateOrderTotal(subtotal, selectedZone?.feeCents ?? null)
```

trocar por:

```ts
  const optionsFeeCents = offer.optionGroups
    .flatMap((group) => group.choices)
    .filter((choice) => selectedChoiceIds.includes(choice.id))
    .reduce((sum, choice) => sum + choice.extraPriceCents, 0) * quantity
  const subtotal = offer.discountPrice * quantity + optionsFeeCents
  const total = calculateOrderTotal(subtotal, selectedZone?.feeCents ?? null)
```

Adicionar a checagem de grupo obrigatório ao `canSubmit` (grupo `required` precisa ter pelo menos uma escolha marcada entre suas `choices`):

```ts
  const missingRequiredGroup = offer.optionGroups.some(
    (group) => group.required && !group.choices.some((choice) => selectedChoiceIds.includes(choice.id)),
  )
```

E incluir `!missingRequiredGroup` na expressão de `canSubmit` já existente (mesma linha que já tem `!cityMismatch`).

No `handleSubmit`, adicionar `selectedChoiceIds` ao objeto passado pra `createOrder.mutateAsync`.

- [ ] **Step 3: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app-mobile/src/api/types.ts app-mobile/app/pedido/\[slug\].tsx
git commit -m "feat(mobile): pick offer customization options and add their cost to the total"
```

---

### Task 8: App mobile — total no histórico de pedidos

**Files:**
- Modify: `app-mobile/app/pedidos.tsx`

**Interfaces:**
- Consumes: `OrderRow.optionsFeeCents` (Task 7).

- [ ] **Step 1: Atualizar o cálculo de total em `app-mobile/app/pedidos.tsx`**

Ler o arquivo primeiro (linha ~57-60 já usa `calculateOrderTotal(item.discountPrice * item.quantity, item.deliveryFeeCents)`). Trocar por:

```tsx
            {formatCents(
              calculateOrderTotal(
                item.discountPrice * item.quantity + (item.optionsFeeCents ?? 0),
                item.deliveryFeeCents,
              ),
            )}
```

- [ ] **Step 2: Checagem de tipos**

```bash
cd app-mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app-mobile/app/pedidos.tsx
git commit -m "feat(mobile): include selected option costs in the order-history total"
```

---

### Task 9: Build final, testes completos e deploy

**Files:** nenhum novo — apenas execução e verificação.

- [ ] **Step 1: Testes e tipos do site**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

- [ ] **Step 2: Testes e tipos do app mobile**

```bash
cd app-mobile
npx tsc --noEmit
npx jest
```

- [ ] **Step 3: Rebuild do export web do app mobile e sync**

```bash
cd app-mobile
npx expo export --platform web --clear
```
Copiar o conteúdo de `app-mobile/dist/` para `public/app/`.

- [ ] **Step 4: Testes do site de novo e build final**

```bash
npx vitest run
npm run build
```

- [ ] **Step 5: Deploy**

```bash
npx vercel --prod
```
Se falhar com `"Not authorized"`, rodar `npx vercel link --yes` e tentar de novo.

- [ ] **Step 6: Verificação manual em produção**

Usando o navegador: em `/comerciante/ofertas/[id]` de uma oferta existente com entrega habilitada, cadastrar um grupo "Sabor" (única escolha, obrigatório) com duas opções, e confirmar que a seção "Opções de personalização" salva corretamente.
