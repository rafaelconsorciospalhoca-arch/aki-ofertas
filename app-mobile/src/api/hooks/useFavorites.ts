import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import type { FavoritesResult } from '@/api/types'

export function useFavorites() {
  const { token, authedFetch } = useAuth()
  return useQuery({
    queryKey: ['favoritos'],
    queryFn: () => authedFetch<FavoritesResult>('/favoritos'),
    enabled: token !== null,
  })
}

export type FavoriteTarget = { offerId: string; businessId?: undefined } | { businessId: string; offerId?: undefined }

export function useToggleFavorite() {
  const { authedFetch } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (target: FavoriteTarget) =>
      authedFetch<{ favorited: boolean }>('/favoritos', { method: 'POST', body: target }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoritos'] })
    },
  })
}
