export type GeocodeResult = { lat: number; lng: number }
export type ReverseGeocodeResult = { city: string; state: string }

const BR_STATE_ABBREVIATIONS: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapá: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceará: 'CE',
  'distrito federal': 'DF',
  'espírito santo': 'ES',
  goiás: 'GO',
  maranhão: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  pará: 'PA',
  paraíba: 'PB',
  paraná: 'PR',
  pernambuco: 'PE',
  piauí: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondônia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'são paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
}

/**
 * Geocodes an address via OpenStreetMap's Nominatim (free, no API key). Server-only:
 * Nominatim's usage policy requires a real identifying User-Agent, which browsers
 * refuse to let client code set — this must run on the server.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AkiOfertas/1.0 (contato@akiofertas.com.br)' },
    })
    if (!response.ok) return null

    const results = await response.json()
    const first = Array.isArray(results) ? results[0] : null
    if (!first) return null

    const lat = Number(first.lat)
    const lng = Number(first.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}

/** Resolves GPS coordinates to a city name via Nominatim's reverse endpoint. */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AkiOfertas/1.0 (contato@akiofertas.com.br)' },
    })
    if (!response.ok) return null

    const data = await response.json()
    const address = data?.address
    const city = address?.city || address?.town || address?.municipality || address?.village
    const stateName: string | undefined = address?.state
    if (!city || !stateName) return null

    const state = BR_STATE_ABBREVIATIONS[stateName.toLowerCase()] ?? stateName
    return { city, state }
  } catch {
    return null
  }
}
