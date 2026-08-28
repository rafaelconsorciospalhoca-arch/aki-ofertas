# Pedidos em Tempo Real + Scanner de QR — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Dois pontos de atrito do dia a dia do comerciante: (1) o painel de Pedidos só atualiza se ele recarregar a página manualmente; (2) validar cupom no balcão exige digitar o código à mão mesmo o cliente tendo um QR na tela. Ambos ficam resolvidos.

**Architecture:** Duas mudanças independentes, cada uma só em componentes client-side já existentes — sem rota nova, sem schema novo, sem dependência de servidor além do que já existe (`router.refresh()`, `validateCoupon`). Item 2 adiciona polling + detecção de novidade no `OrderManager`. Item 3 adiciona leitura de câmera com decodificação local (`jsqr`) no `ValidateCouponForm`.

**Tech Stack:** Next.js 14 (client components), `jsqr` (nova dependência, decodificação de QR pura em JS a partir de pixels de canvas — sem servidor, funciona em qualquer navegador com câmera, incluindo Safari iOS).

## Global Constraints

- Nenhuma rota de API nova — os dois mecanismos reaproveitam ações já existentes (`getOrdersForBusiness` via `router.refresh()`, `validateCoupon`).
- Nenhum dado novo persistido — polling e leitura de câmera são só client-side.
- O aviso sonoro/visual de pedido novo (item 2) nunca dispara no primeiro carregamento da página — só a partir da segunda checagem em diante, comparando contra o que já foi visto.
- O scanner de QR (item 3) não substitui o campo de texto — os dois convivem, o comerciante escolhe.
- Todo texto voltado ao comerciante em português, no tom direto já usado no resto do produto.

---

## 1. Pedidos em tempo real — `src/components/merchant/OrderManager.tsx`

`OrderManager` já é um client component (`'use client'`) que recebe `orders` como prop de um server component pai (`ComercianteDedidosPage` → `getOrdersForBusiness`) e já usa `router.refresh()` depois de mudar o status de um pedido — esse é o mesmo mecanismo que o polling vai reaproveitar: `router.refresh()` reexecuta o server component da rota atual e passa os dados atualizados de volta como prop, sem recarregar a página inteira.

Adiciona:

```typescript
useEffect(() => {
  const interval = setInterval(() => router.refresh(), 20_000)
  return () => clearInterval(interval)
}, [router])
```

Detecção de pedido novo, comparando o `orders` recebido a cada render contra o conjunto de IDs já vistos (guardado em `useRef`, não `useState`, pra não disparar re-render nem entrar no ciclo de dependência do efeito):

```typescript
const seenIds = useRef<Set<string> | null>(null)
const [newOrderBanner, setNewOrderBanner] = useState(false)

useEffect(() => {
  const currentIds = new Set(orders.map((o) => o.id))
  if (seenIds.current === null) {
    // primeira renderização — só estabelece a base, não notifica
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

`playNotificationSound`: um beep curto gerado via Web Audio API (`AudioContext` + `OscillatorNode`, ~200ms, sem precisar de nenhum arquivo de áudio pra hospedar):

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
    // Autoplay/permissão de áudio pode falhar em alguns navegadores antes de
    // qualquer interação do usuário na página — o banner visual já é aviso
    // suficiente nesse caso, não precisa propagar o erro.
  }
}
```

Banner visual, renderizado condicionalmente no topo do componente quando `newOrderBanner` é `true`:

```tsx
{newOrderBanner && (
  <div className="rounded-lg bg-brand-green px-4 py-3 text-sm font-bold text-white">
    🔔 Novo pedido recebido!
  </div>
)}
```

## 2. Scanner de QR — `src/components/merchant/ValidateCouponForm.tsx`

Nova dependência: `jsqr` (`npm install jsqr` em `aki-ofertas`, biblioteca pura JS sem dependências, decodifica QR a partir de um `ImageData` — não depende de nenhuma API de câmera nativa do navegador, então funciona também no Safari iOS, ao contrário da `BarcodeDetector` nativa que só existe no Chrome/Edge).

O componente ganha um botão "Escanear QR" que alterna um estado `scanning: boolean`. Quando `true`, renderiza um `<video>` (stream da câmera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`, pedindo a câmera traseira do celular) e um `<canvas>` escondido usado só pra capturar frames.

Loop de leitura, rodando em `requestAnimationFrame` enquanto `scanning` for `true`:

```typescript
function tick() {
  if (!scanning || !videoRef.current || !canvasRef.current) return
  const video = videoRef.current
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (code?.data) {
      stopScanning()
      handleScanResult(code.data)
      return
    }
  }
  requestAnimationFrame(tick)
}
```

`handleScanResult(data: string)`: normaliza igual ao campo manual (`.trim().toUpperCase()`) e chama `validateCoupon` diretamente — mesmo caminho de sucesso/erro que já existe hoje, sem duplicar lógica. `stopScanning()` para os tracks da câmera (`stream.getTracks().forEach(t => t.stop())`) e volta `scanning` pra `false`.

Erro de permissão de câmera negada (`getUserMedia` rejeitado): mostra uma mensagem inline curta ("Não foi possível acessar a câmera. Você pode digitar o código abaixo.") em vez de travar a tela — o campo de texto continua disponível do lado, como já é hoje.

## Testes

- Nenhum teste automatizado novo — os dois componentes tocados são client components de UI (câmera, timers, áudio), e esse projeto já segue a convenção de não testar componentes React (só `src/lib/*`/`src/actions/*`, confirmado nas specs anteriores desta sessão). Verificação visual via Browser tool antes de concluir: item 2 simulando um pedido novo chegar (inserir direto no banco) enquanto a página está aberta e observando o banner aparecer sozinho; item 3 concedendo permissão de câmera e escaneando um QR real gerado pelo app mobile.

## Erros e casos de borda

- Polling continua rodando mesmo com a aba em segundo plano — `setInterval` do navegador já desacelera sozinho em abas inativas, comportamento nativo aceitável, sem necessidade de código extra pra pausar/retomar.
- Se dois pedidos novos chegarem no mesmo intervalo de 20s, o banner dispara uma vez só (é reavaliado a cada checagem, não por pedido individual) — comportamento aceitável, não precisa de fila de notificações.
- Câmera sem `facingMode: 'environment'` disponível (raro, ex: notebook sem câmera traseira): o navegador cai pra câmera padrão automaticamente, sem erro — comportamento nativo do `getUserMedia`.
- QR de outro app/formato diferente do gerado pelo Aki Ofertas: `jsQR` decodifica qualquer QR válido, então o texto lido pode não ser um código de cupom real — `validateCoupon` já trata isso hoje (retorna erro "cupom não encontrado" ou similar), sem necessidade de validação de formato adicional no scanner.
