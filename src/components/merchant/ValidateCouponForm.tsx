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
