import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { OfferDetail } from '@/api/types'

export function useOfferDetail(slug: string) {
  return useQuery({
    queryKey: ['oferta', slug],
    queryFn: () => apiFetch<OfferDetail>(`/ofertas/${slug}`),
  })
}
