// app-mobile/src/api/hooks/useCities.ts
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { City } from '@/api/types'

export function useCities() {
  return useQuery({
    queryKey: ['cidades'],
    queryFn: () => apiFetch<City[]>('/cidades'),
  })
}
