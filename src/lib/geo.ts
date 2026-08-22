const EARTH_RADIUS_KM = 6371

type Coordinates = { lat: number; lng: number }

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  const rounded = Math.round(km * 10) / 10
  return Number.isInteger(rounded)
    ? `${rounded} km`
    : `${rounded.toFixed(1).replace('.', ',')} km`
}
