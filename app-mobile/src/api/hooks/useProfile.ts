import { useQuery } from '@tanstack/react-query'
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
