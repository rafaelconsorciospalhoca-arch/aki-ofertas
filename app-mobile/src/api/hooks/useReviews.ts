import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import type { ReviewsSummary } from '@/api/types'

export function useReviews(slug: string) {
  return useQuery({
    queryKey: ['avaliacoes', slug],
    queryFn: () => apiFetch<ReviewsSummary>(`/lojas/${slug}/avaliacoes`),
  })
}

export function useSubmitReview(slug: string) {
  const { authedFetch } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { rating: number; comment?: string }) =>
      authedFetch<void>(`/lojas/${slug}/avaliacoes`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes', slug] })
    },
  })
}
