# Pedidos em Tempo Real + Scanner de QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `OrderManager` avisa sozinho (som + banner) quando chega um pedido novo, sem precisar recarregar a página. `ValidateCouponForm` ganha um scanner de QR que valida o cupom automaticamente assim que reconhece o código.

**Architecture:** Ver `docs/superpowers/specs/2026-08-28-live-orders-qr-scanner-design.md` pro raciocínio completo. Duas mudanças independentes, só em client components já existentes, sem rota nova nem schema novo.

**Tech Stack:** Next.js 14 (client components), `jsqr` (nova dependência).

## Global Constraints

- Nenhuma rota de API nova.
- O aviso de pedido novo nunca dispara no primeiro carregamento da página — só a partir da segunda checagem em diante.
- O campo de texto do cupom continua funcionando normalmente ao lado do scanner — um não substitui o outro.
- Nenhum teste automatizado novo é esperado (componentes de UI com câmera/timer/áudio, fora do padrão de testes deste projeto que só cobre `src/lib`/`src/actions`) — a verificação é manual, via Browser tool, no Task 3.

---

### Task 1: Pedidos em tempo real — `OrderManager.tsx`

**Files:**
- Modify: `src/components/merchant/OrderManager.tsx`

**Interfaces:**
- Não muda a assinatura do componente (`{ orders: Order[] }`) nem introduz nenhuma prop nova — é só comportamento interno.

- [ ] **Step 1: Adicionar o polling**

Em `src/components/merchant/OrderManager.tsx`, adicionar `useEffect` ao import do `react` (`import { useEffect, useRef, useState } from 'react'` — já tem `useState`, só falta `useEffect`/`useRef`), e dentro do componente, logo após a declaração de `pendingId`:

```typescript
useEffect(() => {
  const interval = setInterval(() => router.refresh(), 20_000)
  return () => clearInterval(interval)
}, [router])
```

- [ ] **Step 2: Adicionar a detecção de pedido novo + o som**

Logo abaixo do `useEffect` do Step 1, dentro do mesmo componente:

```typescript
const seenIds = useRef<Set<string> | null>(null)
const [newOrderBanner, setNewOrderBanner] = useState(false)

useEffect(() => {
  const currentIds = new Set(orders.map((o) => o.id))
  if (seenIds.current === null) {
    seenIds.current = currentIds
    return
  }
  const hasNewOrder = orders.some((o) => !seenIds.current!.has(o.id))
  if (hasNewOrder) {
    setNewOrderBanner(true)
    playNotificationSound()
    setTimeout(() => setNewOrderBanner(false), 6000)
  }
  seenIds.current = currentIds
}, [orders])
```

E, fora do componente (função auxiliar de módulo, junto de `formatDate`):

```typescript
function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.3)
  } catch {
    // Autoplay/permissão de áudio pode falhar antes de qualquer interação do
    // usuário na página — o banner visual já é aviso suficiente nesse caso.
  }
}
```

- [ ] **Step 3: Renderizar o banner**

No JSX retornado por `OrderManager`, logo antes do `.map(...)` que lista os pedidos (dentro do `<div className="flex flex-col gap-3">` existente, como primeiro filho):

```tsx
{newOrderBanner && (
  <div className="rounded-lg bg-brand-green px-4 py-3 text-sm font-bold text-white">
    🔔 Novo pedido recebido!
  </div>
)}
```

Atenção: o componente hoje retorna cedo com uma mensagem de "nenhum pedido" quando `orders.length === 0` (`if (orders.length === 0) { return <p>...</p> }`), **antes** do bloco que vai receber o banner — esse `return` antecipado continua exatamente como está, sem mudança (não faz sentido mostrar "novo pedido" numa tela que também diz "nenhum pedido").

- [ ] **Step 4: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add src/components/merchant/OrderManager.tsx
git commit -m "feat: poll for new orders and notify the merchant with sound + banner"
```

---

### Task 2: Scanner de QR — `ValidateCouponForm.tsx`

**Files:**
- Modify: `src/components/merchant/ValidateCouponForm.tsx`
- Modify: `package.json` (nova dependência `jsqr`)

**Interfaces:**
- Não muda a assinatura do componente (`ValidateCouponForm()`, sem props) — é só comportamento interno.
- Consumes: `validateCoupon` (já existe em `@/actions/coupon-actions`, sem mudança de assinatura).

- [ ] **Step 1: Instalar a dependência**

Run: `npm install jsqr`
Expected: `jsqr` aparece em `package.json`/`package-lock.json`.

- [ ] **Step 2: Reescrever `ValidateCouponForm.tsx` com o scanner**

Substituir o conteúdo completo do arquivo por:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { validateCoupon } from '@/actions/coupon-actions'

type Result = { ok: true; offerTitle: string; customerName: string } | { ok: false; error: string } | null

export function ValidateCouponForm() {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  async function submitCode(value: string) {
    setPending(true)
    setResult(null)
    try {
      const response = await validateCoupon(value.trim().toUpperCase())
      setResult(response)
      if (response.ok) setCode('')
    } catch {
      setResult({ ok: false, error: 'Não foi possível concluir. Tente novamente.' })
    } finally {
      setPending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitCode(code)
  }

  function stopScanning() {
    scanningRef.current = false
    setScanning(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function startScanning() {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      scanningRef.current = true
      setScanning(true)
    } catch {
      setCameraError('Não foi possível acessar a câmera. Você pode digitar o código abaixo.')
    }
  }

  useEffect(() => {
    if (!scanning || !videoRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play()

    function tick() {
      if (!scanningRef.current || !videoRef.current || !canvasRef.current) return
      const currentVideo = videoRef.current
      if (currentVideo.readyState === currentVideo.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current
        canvas.width = currentVideo.videoWidth
        canvas.height = currentVideo.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(currentVideo, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code?.data) {
            stopScanning()
            submitCode(code.data)
            return
          }
        }
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    return () => {
      scanningRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {!scanning ? (
        <button
          type="button"
          onClick={startScanning}
          className="rounded-lg border border-brand-green px-4 py-2 text-sm font-bold text-brand-green"
        >
          📷 Escanear QR
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <video ref={videoRef} className="w-full rounded-lg" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <button
            type="button"
            onClick={stopScanning}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-600"
          >
            Cancelar
          </button>
        </div>
      )}

      {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código do cupom"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase tracking-widest"
          required
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? 'Validando...' : 'Validar'}
        </button>
      </form>

      {result && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            result.ok ? 'bg-brand-green/10 text-brand-green' : 'bg-red-50 text-red-600'
          }`}
        >
          {result.ok ? (
            <>
              <p className="font-bold">Cupom validado!</p>
              <p>
                {result.offerTitle} — {result.customerName}
              </p>
            </>
          ) : (
            result.error
          )}
        </div>
      )}
    </div>
  )
}
```

Notas sobre esse rewrite: `submitCode` extrai a lógica que antes só vivia em `handleSubmit`, pra ser reaproveitada tanto pelo envio manual quanto pelo resultado do scanner, sem duplicar a chamada a `validateCoupon`. `scanningRef` existe paralelo ao state `scanning` porque o loop de `requestAnimationFrame` roda fora do ciclo de render do React e precisa checar o valor mais atual de "ainda escaneando" a cada frame sem re-criar o closure — ler direto de `scanning` (state) dentro do `tick` capturaria um valor desatualizado da primeira execução do efeito.

- [ ] **Step 3: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros de tipo (`jsqr` não tem types próprios publicados — se `tsc` reclamar de tipo implícito `any` pro import, criar `src/types/jsqr.d.ts` com `declare module 'jsqr'` e uma assinatura mínima: `export default function jsQR(data: Uint8ClampedArray, width: number, height: number): { data: string } | null`).

- [ ] **Step 4: Commit**

```bash
git add src/components/merchant/ValidateCouponForm.tsx package.json package-lock.json
git add src/types/jsqr.d.ts 2>/dev/null || true
git commit -m "feat: add QR camera scanner to coupon validation"
```

---

### Task 3: Verificação e deploy

**Files:** nenhum arquivo novo — task de verificação e publicação.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes passam (nenhum teste novo nesta feature, então a contagem deve ficar igual à do baseline atual).

- [ ] **Step 2: Verificação manual — pedidos em tempo real**

Iniciar o dev server (`preview_start` com `aki-ofertas-dev`). Logar como o comerciante seed, abrir `/comerciante/pedidos`. Com a página aberta, inserir um pedido novo direto no banco via script Node (mesmo padrão já usado nesta sessão, reaproveitando `src/lib/db.ts`) pro business seed. Esperar até 20s e confirmar que a lista atualiza sozinha e o banner "🔔 Novo pedido recebido!" aparece por alguns segundos, sem precisar recarregar a página. Limpar o pedido de teste depois.

- [ ] **Step 3: Verificação manual — scanner de QR**

Na mesma sessão de comerciante, ir em `/comerciante/cupons/validar`, clicar "Escanear QR", conceder permissão de câmera no navegador, e apontar pra um QR real (gerar um cupom de teste no app mobile ou export web, que já mostra o QR desde a sessão anterior desta conversa). Confirmar que a validação acontece sozinha assim que a câmera reconhece o código, sem precisar clicar em "Validar". Testar também negar a permissão de câmera e confirmar que a mensagem de erro amigável aparece e o campo de texto continua funcionando.

- [ ] **Step 4: Build de produção**

Run: `npm run build`
Expected: build limpo, sem erros.

- [ ] **Step 5: Deploy**

Run: `npx vercel --prod`

- [ ] **Step 6: Verificação ao vivo em produção**

Via Browser tool: confirmar que `/comerciante/pedidos` e `/comerciante/cupons/validar` carregam sem erro em produção (logado como comerciante), sem erros de console.
