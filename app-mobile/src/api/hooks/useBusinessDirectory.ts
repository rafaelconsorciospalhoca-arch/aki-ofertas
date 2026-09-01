import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { BusinessSummary } from '@/api/types'
import type { StoredLocation } from '@/storage/location'

export function useBusinessDirectory(location: StoredLocation | null, filters: { categoria?: string }) {
  const params = new URLSearchParams()
  if (location?.type === 'city') {
    params.set('cidade', `${location.name}|${location.state}`)
  } else if (location?.type === 'gps' && location.cityLabel) {
    const [name, state] = location.cityLabel.split(' - ')
    if (name && state) params.set('cidade', `${name}|${state}`)
  }
  if (filters.categoria) params.set('categoria', filters.categoria)
  const query = params.toString()

  return useQuery({
    queryKey: ['lojas-diretorio', query],
    queryFn: () => apiFetch<BusinessSummary[]>(`/lojas?${query}`),
    enabled: location !== null,
  })
}
