export type GeocodeResult = { lat: number; lng: number }

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
