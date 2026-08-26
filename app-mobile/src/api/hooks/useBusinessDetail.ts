import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { BusinessDetail } from '@/api/types'

export function useBusinessDetail(slug: string) {
  return useQuery({
    queryKey: ['loja', slug],
    queryFn: () => apiFetch<BusinessDetail>(`/lojas/${slug}`),
  })
}
