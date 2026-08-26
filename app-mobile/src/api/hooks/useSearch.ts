import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { OfferListItem, BusinessSummary } from '@/api/types'

export function useSearch(query: string) {
  const trimmed = query.trim()
  const enabled = trimmed.length > 0

  const offers = useQuery({
    queryKey: ['busca-ofertas', trimmed],
    queryFn: () => apiFetch<OfferListItem[]>(`/ofertas?q=${encodeURIComponent(trimmed)}`),
    enabled,
  })

  const businesses = useQuery({
    queryKey: ['busca-lojas', trimmed],
    queryFn: () => apiFetch<BusinessSummary[]>(`/lojas?q=${encodeURIComponent(trimmed)}`),
    enabled,
  })

  return {
    active: enabled,
    isLoading: offers.isLoading || businesses.isLoading,
    offers: offers.data ?? [],
    businesses: businesses.data ?? [],
  }
}
