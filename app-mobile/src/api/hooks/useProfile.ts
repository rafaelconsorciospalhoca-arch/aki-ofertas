import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import type { Profile } from '@/api/types'

export function useProfile() {
  const { token, authedFetch } = useAuth()
  return useQuery({
    queryKey: ['perfil'],
    queryFn: () => authedFetch<Profile>('/perfil'),
    enabled: token !== null,
  })
}

export function useUpdateProfile() {
  const { authedFetch } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { name: string; phone: string }) =>
      authedFetch<{ ok: true }>('/perfil', { method: 'PUT', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfil'] })
    },
  })
}
