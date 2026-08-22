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

  function handleActivateLocation() {
    setError(null)
    if (!navigator.geolocation) {
      setError('Seu navegador não suporta localização. Escolha sua cidade abaixo.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCookie(GEO_COOKIE, serializeGeoCookie({ lat: position.coords.latitude, lng: position.coords.longitude }))
        router.push('/')
      },
      () => {
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Permita sua localização</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Assim podemos mostrar as melhores ofertas e estabelecimentos perto de você.
        </p>
      </div>

      <button
        type="button"
        onClick={handleActivateLocation}
        className="w-full max-w-xs rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
      >
        Ativar localização
      </button>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Ou escolha sua cidade</option>
          {cities.map((city) => (
            <option key={city.id} value={city.name}>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="button" onClick={() => router.push('/')} className="text-sm text-neutral-400">
        Agora não
      </button>
    </div>
  )
}
