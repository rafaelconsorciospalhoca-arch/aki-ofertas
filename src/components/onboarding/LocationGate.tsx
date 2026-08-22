'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CITY_COOKIE, GEO_COOKIE, serializeGeoCookie } from '@/lib/location'

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`
}

export function LocationGate({
  cities,
}: {
  cities: { id: string; name: string; state: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState('')
  const [locating, setLocating] = useState(false)

  function handleActivateLocation() {
    setError(null)
    if (!navigator.geolocation) {
      setError('Seu navegador não suporta localização. Escolha sua cidade abaixo.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCookie(GEO_COOKIE, serializeGeoCookie({ lat: position.coords.latitude, lng: position.coords.longitude }))
        router.push('/')
      },
      () => {
        setLocating(false)
        setError('Não conseguimos acessar sua localização. Escolha sua cidade abaixo.')
      },
    )
  }

  function handleManualCity() {
    if (!selectedCity) {
      setError('Escolha uma cidade.')
      return
    }
    setCookie(CITY_COOKIE, selectedCity)
    router.push('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-navy-dark to-brand-navy p-6 text-center text-white">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green-light">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
            <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" fill="#0A1830" />
            <circle cx="12" cy="9.5" r="2.4" fill="#fff" />
          </svg>
        </span>
        <p className="text-lg font-bold">
          Aki <span className="text-brand-green-light">Ofertas</span>
        </p>
      </div>

      <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-left text-neutral-900">
        <h1 className="text-base font-bold">Permita sua localização</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
          Assim podemos mostrar as melhores ofertas e estabelecimentos perto de você.
        </p>

        <button
          type="button"
          onClick={handleActivateLocation}
          disabled={locating}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
        >
          {locating ? (
            'Localizando...'
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4">
                <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
                <circle cx="12" cy="9.5" r="2" />
              </svg>
              Ativar localização
            </>
          )}
        </button>

        <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" />
          ou
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Escolha sua cidade</option>
            {cities.map((city) => (
              <option key={city.id} value={`${city.name}|${city.state}`}>
                {city.name} - {city.state}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleManualCity}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700"
          >
            Continuar com esta cidade
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>

      <button type="button" onClick={() => router.push('/')} className="text-sm text-neutral-300">
        Agora não
      </button>
    </div>
  )
}
