export type Coordinates = { lat: number; lng: number }

export const GEO_COOKIE = 'aki_geo'
export const CITY_COOKIE = 'aki_city'

export function parseGeoCookie(value: string | undefined | null): Coordinates | null {
  if (!value) return null
  const parts = value.split(',')
  if (parts.length !== 2) return null

  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  return { lat, lng }
}

export function serializeGeoCookie(coords: Coordinates): string {
  return `${coords.lat},${coords.lng}`
}

export type CityCookie = { name: string; state: string }

export function serializeCityCookie(city: CityCookie): string {
  return `${city.name}|${city.state}`
}

export function parseCityCookie(value: string | undefined | null): CityCookie | null {
  if (!value) return null
  const parts = value.split('|')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return { name: parts[0], state: parts[1] }
}
