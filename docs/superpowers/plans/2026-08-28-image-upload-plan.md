# Upload de Imagem em vez de URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os 4 campos de "URL da imagem" do painel do comerciante por upload de arquivo de verdade, via Vercel Blob. Ver `docs/superpowers/specs/2026-08-28-image-upload-design.md` pro raciocínio completo.

**Architecture:** Uma rota de autorização de upload + um componente `ImageUploadField` reutilizável, aplicado nos 4 campos existentes. Sem mudança de schema.

**Tech Stack:** `@vercel/blob` (nova dependência), Next.js 14 Route Handler.

## Global Constraints

- Nenhuma mudança de schema — os 4 campos continuam string/URL no banco.
- Só sessão de comerciante (`role: 'MERCHANT'`) consegue pedir token de upload.
- Tipos aceitos: JPEG, PNG, WEBP. Limite: 5MB, checado no cliente e na rota de autorização.
- Nenhum teste automatizado esperado (componente de UI com upload de arquivo real, fora da convenção deste projeto) — verificação manual via Browser tool no Task 3.
- Pré-requisito de infraestrutura fora do código: o Blob Store precisa estar ativado no painel da Vercel antes do upload funcionar de verdade em produção (`BLOB_READ_WRITE_TOKEN` é injetado automaticamente quando isso acontece).

---

### Task 1: Rota de autorização + componente `ImageUploadField`

**Files:**
- Create: `src/app/api/upload/route.ts`
- Create: `src/components/merchant/ImageUploadField.tsx`
- Modify: `package.json` (nova dependência `@vercel/blob`)

**Interfaces:**
- Produces: `ImageUploadField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (url: string) => void })` — componente controlado, consumido pelo Task 2 nos 3 formulários.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install @vercel/blob`
Expected: `@vercel/blob` aparece em `package.json`/`package-lock.json`.

- [ ] **Step 2: Criar a rota de autorização**

Criar `src/app/api/upload/route.ts` com o código exato do documento de design, seção 1 — usa `handleUpload` de `@vercel/blob/client`, checa `auth()` + `role === 'MERCHANT'` em `onBeforeGenerateToken`, restringe `allowedContentTypes` a `['image/jpeg', 'image/png', 'image/webp']` e `maximumSizeInBytes` a `5 * 1024 * 1024`.

- [ ] **Step 3: Criar o componente `ImageUploadField`**

Criar `src/components/merchant/ImageUploadField.tsx` com o código exato do documento de design, seção 2 — componente `'use client'`, usa `upload()` de `@vercel/blob/client` apontando pra `/api/upload`, valida tipo/tamanho no cliente antes de enviar, mostra prévia/estado de carregamento/erro, e os botões "Trocar imagem"/"Remover" quando já existe uma imagem.

- [ ] **Step 4: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/upload/route.ts src/components/merchant/ImageUploadField.tsx package.json package-lock.json
git commit -m "feat: add Vercel Blob upload route and reusable ImageUploadField component"
```

---

### Task 2: Aplicar nos 4 campos existentes

**Files:**
- Modify: `src/components/merchant/OfferForm.tsx`
- Modify: `src/components/merchant/BusinessProfileForm.tsx`
- Modify: `src/components/merchant/MenuManager.tsx`

**Interfaces:**
- Consumes: `ImageUploadField` (Task 1).

- [ ] **Step 1: `OfferForm.tsx`**

Adicionar `import { ImageUploadField } from './ImageUploadField'` no topo. Substituir o bloco:

```tsx
<label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
  URL da imagem
  <input
    value={values.imageUrl}
    onChange={(e) => update('imageUrl', e.target.value)}
    className={inputClass}
    placeholder="https://..."
  />
</label>
```

por:

```tsx
<ImageUploadField
  label="Imagem da oferta"
  hint="Recomendado: 800×600px (paisagem), até 5MB"
  value={values.imageUrl}
  onChange={(url) => update('imageUrl', url)}
/>
```

- [ ] **Step 2: `BusinessProfileForm.tsx`**

Adicionar `import { ImageUploadField } from './ImageUploadField'` no topo. Substituir os dois blocos:

```tsx
<label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
  URL do logo
  <input value={values.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} className={inputClass} placeholder="https://..." />
</label>

<label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
  URL da capa
  <input value={values.coverUrl} onChange={(e) => update('coverUrl', e.target.value)} className={inputClass} placeholder="https://..." />
</label>
```

por:

```tsx
<ImageUploadField
  label="Logo da loja"
  hint="Recomendado: 400×400px (quadrada), até 2MB"
  value={values.logoUrl}
  onChange={(url) => update('logoUrl', url)}
/>

<ImageUploadField
  label="Capa da loja"
  hint="Recomendado: 1200×400px (larga), até 5MB"
  value={values.coverUrl}
  onChange={(url) => update('coverUrl', url)}
/>
```

- [ ] **Step 3: `MenuManager.tsx`**

Adicionar `import { ImageUploadField } from './ImageUploadField'` no topo. Substituir o bloco:

```tsx
<label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
  URL da imagem
  <input
    value={values.imageUrl}
    onChange={(e) => update('imageUrl', e.target.value)}
    className={inputClass}
    placeholder="https://..."
  />
</label>
```

por:

```tsx
<ImageUploadField
  label="Imagem do item"
  hint="Recomendado: 600×600px (quadrada), até 3MB"
  value={values.imageUrl}
  onChange={(url) => update('imageUrl', url)}
/>
```

- [ ] **Step 4: Rodar o typecheck e a suíte completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam (nenhum teste novo esperado, contagem igual ao baseline).

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant/OfferForm.tsx src/components/merchant/BusinessProfileForm.tsx src/components/merchant/MenuManager.tsx
git commit -m "feat: replace image URL fields with real upload in merchant forms"
```

---

### Task 3: Verificação e deploy

**Files:** nenhum arquivo novo — task de verificação e publicação.

- [ ] **Step 1: Confirmar o pré-requisito de infraestrutura**

Antes de testar de verdade, confirmar com o usuário que o Blob Store já foi ativado no painel da Vercel (Storage → Create Database → Blob) — sem isso, o upload falha com erro genérico tanto local quanto em produção, o que não é um bug de código.

- [ ] **Step 2: Verificação manual local**

Iniciar o dev server (`preview_start` com `aki-ofertas-dev`). Logar como o comerciante seed. Testar upload de uma imagem real (JPG ou PNG pequeno) em cada um dos 4 campos: nova oferta, editar empresa (logo e capa), item do cardápio. Confirmar que a prévia aparece, que salvar o formulário funciona, e que a imagem enviada realmente aparece depois nas telas públicas correspondentes (card de oferta em `/ofertas`, capa/logo em `/loja/[slug]`, item do cardápio na mesma página). Testar também um arquivo grande demais ou de tipo errado, confirmando a mensagem de erro amigável.

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build limpo, sem erros.

- [ ] **Step 4: Deploy**

Run: `npx vercel --prod`

- [ ] **Step 5: Verificação ao vivo em produção**

Via Browser tool: repetir pelo menos um upload real (ex: imagem de oferta) em produção, logado como comerciante, confirmando que o arquivo sobe e a URL retornada funciona de verdade (não só localmente) — isso prova que o `BLOB_READ_WRITE_TOKEN` de produção está configurado corretamente.
