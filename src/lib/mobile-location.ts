import type { Coordinates, CityCookie } from '@/lib/location'

export function parseLocationParams(searchParams: URLSearchParams): {
  location: Coordinates | null
  city: CityCookie | null
} {
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const location =
    lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : null

  const cidade = searchParams.get('cidade')
  const [name, state] = cidade?.split('|') ?? []
  const city = !location && name && state ? { name, state } : null

  return { location, city }
}
