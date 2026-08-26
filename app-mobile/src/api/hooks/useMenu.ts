import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { MenuItemRow } from '@/api/types'

export function useMenu(slug: string) {
  return useQuery({
    queryKey: ['cardapio', slug],
    queryFn: () => apiFetch<MenuItemRow[]>(`/lojas/${slug}/cardapio`),
  })
}
