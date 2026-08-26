import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { OfferListItem } from '@/api/types'
import type { StoredLocation } from '@/storage/location'

function buildQueryString(location: StoredLocation | null): string {
  const params = new URLSearchParams()
  if (location?.type === 'gps') {
    params.set('lat', String(location.lat))
    params.set('lng', String(location.lng))
  } else if (location?.type === 'city') {
    params.set('cidade', `${location.name}|${location.state}`)
  }
  return params.toString()
}

export function useFeaturedOffers(location: StoredLocation | null) {
  const query = buildQueryString(location)
  return useQuery({
    queryKey: ['ofertas-destaque', query],
    queryFn: () => apiFetch<OfferListItem[]>(`/ofertas/destaque?${query}`),
    enabled: location !== null,
  })
}
