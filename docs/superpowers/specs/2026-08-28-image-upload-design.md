# Upload de Imagem em vez de URL — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Os 4 campos de "URL da imagem" do painel do comerciante (oferta, logo da loja, capa da loja, item do cardápio) viram upload de arquivo de verdade — escolhe a imagem do computador/celular, ela sobe pro Vercel Blob, e o campo (que continua guardando só a URL no banco, sem mudança de schema) é preenchido sozinho.

**Architecture:** Um componente `ImageUploadField` reutilizável, controlado como um input comum (`value`/`onChange` de string), substitui os 4 `<input placeholder="https://...">` existentes. O upload em si vai direto do navegador pro Vercel Blob (client upload), autorizado por uma rota que só libera token pra sessão de comerciante autenticada — os bytes do arquivo nunca passam pela função serverless do Vercel, evitando o limite de tamanho de corpo de requisição.

**Tech Stack:** `@vercel/blob` (nova dependência), Next.js 14 Route Handler.

## Global Constraints

- Nenhuma mudança de schema — `Offer.imageUrl`, `Business.logoUrl`, `Business.coverUrl`, `MenuItem.imageUrl` continuam sendo campos de texto guardando uma URL, exatamente como hoje. Só a forma de preencher esse texto muda.
- Só comerciante autenticado (sessão com `role: 'MERCHANT'`) consegue pedir um token de upload — a rota de autorização checa isso antes de liberar.
- Tipos aceitos: `image/jpeg`, `image/png`, `image/webp`. Tamanho máximo: 5MB (o maior dos tamanhos recomendados por campo) — checado tanto no cliente (antes de tentar o upload, pra dar erro rápido) quanto na rota de autorização do Blob (`maximumSizeInBytes`, defesa em profundidade caso o cliente seja driblado).
- O texto de tamanho recomendado por campo é só orientação (não bloqueia o envio de uma imagem fora dessas dimensões) — a única coisa que bloqueia é tipo de arquivo errado ou tamanho acima de 5MB.
- Pré-requisito de infraestrutura, fora do código: o usuário precisa ativar um Blob Store no painel da Vercel (Storage → Create Database → Blob) antes desta feature funcionar em produção — isso injeta `BLOB_READ_WRITE_TOKEN` automaticamente nas variáveis de ambiente do projeto, sem precisar editar nada manualmente.

---

## 1. Rota de autorização — `src/app/api/upload/route.ts`

```typescript
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth()
        if (!session?.user || (session.user as { role?: string }).role !== 'MERCHANT') {
          throw new Error('Não autorizado.')
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // Nada a persistir aqui — a URL retornada já vai direto pro campo do
        // formulário no cliente, e só é salva no banco quando o comerciante
        // salva o formulário inteiro (mesmo fluxo de hoje com URL colada).
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
```

## 2. Componente reutilizável — `src/components/merchant/ImageUploadField.tsx`

```typescript
'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato não aceito. Use JPG, PNG ou WEBP.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Imagem muito grande. O limite é 5MB.')
      return
    }

    setUploading(true)
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      })
      onChange(blob.url)
    } catch {
      setError('Não foi possível enviar a imagem. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
      <span>{label}</span>
      <span className="text-xs font-normal text-neutral-400">{hint}</span>

      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt={label} className="h-20 w-20 rounded-lg object-cover" />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs font-bold text-brand-green"
            >
              Trocar imagem
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs font-bold text-red-600"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 text-xs text-neutral-500 disabled:opacity-60"
        >
          {uploading ? 'Enviando...' : '📷 Escolher imagem'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="text-xs font-normal text-red-600">{error}</p>}
    </div>
  )
}
```

Componente **controlado**, igual a um `<input>` comum — recebe `value` (a URL atual, string vazia se nenhuma) e chama `onChange(novaUrl)` quando o upload termina ou quando o comerciante remove a imagem. Isso significa que os 3 formulários que o usam não mudam o resto da lógica (`update('imageUrl', ...)` já existente continua funcionando igual, só troca o `<input>` de texto por este componente).

## 3. Aplicar nos 4 lugares

Em cada um dos 3 arquivos abaixo, o bloco `<label>...<input placeholder="https://...">...</label>` referente a imagem é substituído por uma chamada ao componente, mantendo o texto recomendado específico de cada campo:

**`src/components/merchant/OfferForm.tsx`** (campo `imageUrl` da oferta):
```tsx
<ImageUploadField
  label="Imagem da oferta"
  hint="Recomendado: 800×600px (paisagem), até 5MB"
  value={values.imageUrl}
  onChange={(url) => update('imageUrl', url)}
/>
```

**`src/components/merchant/BusinessProfileForm.tsx`** (dois campos, `logoUrl` e `coverUrl`):
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

**`src/components/merchant/MenuManager.tsx`** (campo `imageUrl` do item do cardápio):
```tsx
<ImageUploadField
  label="Imagem do item"
  hint="Recomendado: 600×600px (quadrada), até 3MB"
  value={values.imageUrl}
  onChange={(url) => update('imageUrl', url)}
/>
```

O limite de 2MB/3MB nos textos de logo/item do cardápio é só a *sugestão exibida* — o limite de verdade, checado no componente e na rota, é sempre 5MB pros quatro campos (mantendo o componente simples, sem precisar de uma prop de limite por campo).

## Testes

- Nenhum teste automatizado — componente de UI com upload de arquivo real (`File`, `FormData`, chamada de rede pro Blob), fora da convenção de testes deste projeto (só `src/lib`/`src/actions`). Verificação manual via Browser tool: fazer upload de uma imagem real em cada um dos 4 campos, confirmar que a prévia aparece, que o formulário salva a URL certa, e que a imagem realmente aparece depois nas telas públicas (card de oferta, página da loja, cardápio).

## Erros e casos de borda

- Arquivo de tipo errado (ex: PDF) ou maior que 5MB: rejeitado no cliente antes de tentar o upload, com mensagem clara — nunca chega a gastar banda enviando um arquivo que vai ser rejeitado.
- Sessão expira no meio do upload (comerciante deslogado em outra aba, como no caso do bug de sessão única já corrigido nesta sessão): a rota de autorização rejeita, componente mostra "Não foi possível enviar a imagem. Tente novamente." — comerciante percebe e loga de novo.
- Comerciante clica "Remover": `onChange('')` limpa o campo, mas o arquivo já enviado ao Blob continua existindo lá (arquivo órfão) — aceitável para o escopo desta feature; limpeza de blobs órfãos fica pra um projeto futuro se o volume justificar, não é um problema de correção, só de armazenamento não reaproveitado.
- Blob Store não configurado ainda no projeto Vercel (`BLOB_READ_WRITE_TOKEN` ausente): a chamada a `handleUpload` falha, a rota responde 400, e o componente mostra a mesma mensagem de erro genérica — não trava a aplicação, só a funcionalidade de upload fica indisponível até o usuário completar o passo de infraestrutura.
