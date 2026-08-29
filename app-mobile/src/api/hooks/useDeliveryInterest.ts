import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'

export function useDeliveryInterest() {
  const { authedFetch } = useAuth()

  return useMutation({
    mutationFn: (input: { businessId: string; neighborhood: string }) =>
      authedFetch<{ ok: true }>('/entrega/interesse', { method: 'POST', body: input }),
  })
}
