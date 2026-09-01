'use client'

import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 20_000

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    // Two short beeps read as more "alert-like" than one, and are easier to
    // notice from across the room than a single tone.
    ;[0, 0.35].forEach((delay) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.frequency.value = 880
      gain.gain.setValueAtTime(0.2, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3)
      oscillator.start(ctx.currentTime + delay)
      oscillator.stop(ctx.currentTime + delay + 0.3)
    })
  } catch {
    // Autoplay/permissão de áudio pode falhar antes de qualquer interação do
    // usuário na página — o banner visual já é aviso suficiente nesse caso.
  }
}

// Mounted once in the merchant dashboard's persistent layout (not the
// /comerciante/pedidos page alone) so the alert fires regardless of which
// panel page the merchant currently has open. Re-alerts on every poll
// (every 20s) for as long as at least one order is still PENDING — a single
// beep is easy to miss, so this keeps going until the merchant confirms or
// cancels the order, not just once when it first arrives.
export function OrderNotificationWatcher() {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/comerciante/pedidos-recentes')
        if (!res.ok) return
        const body = await res.json()
        if (cancelled || !body.ok) return

        const pendingIds: string[] = body.data
        if (pendingIds.length > 0) {
          playNotificationSound()
        }
        setPendingCount(pendingIds.length)
      } catch {
        // Transient network errors just skip this poll — retried next interval.
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (pendingCount === 0) return null

  return (
    <div className="fixed right-4 top-4 z-50 rounded-lg bg-brand-green px-4 py-3 text-sm font-bold text-white shadow-lg">
      🔔 {pendingCount} pedido{pendingCount === 1 ? '' : 's'} aguardando confirmação
    </div>
  )
}
