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
