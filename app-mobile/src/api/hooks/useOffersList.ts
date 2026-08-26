import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { OfferListItem } from '@/api/types'
import type { StoredLocation } from '@/storage/location'

export function useOffersList(
  location: StoredLocation | null,
  filters: { categoria?: string; raio?: number },
) {
  const params = new URLSearchParams()
  if (location?.type === 'gps') {
    params.set('lat', String(location.lat))
    params.set('lng', String(location.lng))
  } else if (location?.type === 'city') {
    params.set('cidade', `${location.name}|${location.state}`)
  }
  if (filters.categoria) params.set('categoria', filters.categoria)
  if (filters.raio) params.set('raio', String(filters.raio))
  const query = params.toString()

  return useQuery({
    queryKey: ['ofertas', query],
    queryFn: () => apiFetch<OfferListItem[]>(`/ofertas?${query}`),
    enabled: location !== null,
  })
}
