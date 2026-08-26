import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { Category } from '@/api/types'

export function useCategories() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => apiFetch<Category[]>('/categorias'),
  })
}
