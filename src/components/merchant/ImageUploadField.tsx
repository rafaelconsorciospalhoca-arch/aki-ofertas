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
      // Nomes de arquivo vindos direto do WhatsApp/câmera (ex: "WhatsApp Image
      // 2026-08-19 at 09.38.35.jpeg") têm espaços e pontos que já foram
      // observados quebrando o upload — geramos um nome seguro em vez de usar
      // o original, o que também evita expor o nome do arquivo do dispositivo.
      const extensionMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name)
      const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg'
      const safeName = `${crypto.randomUUID()}.${extension}`

      const blob = await upload(safeName, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        abortSignal: AbortSignal.timeout(30_000),
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
