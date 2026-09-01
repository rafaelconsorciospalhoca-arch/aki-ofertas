import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import type { CreateOrderInput, OrderRow } from '@/api/types'

export function useOrders() {
  const { token, authedFetch } = useAuth()
  return useQuery({
    queryKey: ['pedidos'],
    queryFn: () => authedFetch<OrderRow[]>('/pedidos'),
    enabled: token !== null,
    // The merchant updates status from their own panel, so the customer's
    // list needs to notice on its own rather than only on manual refresh.
    refetchInterval: 30000,
  })
}

export function useCreateOrder() {
  const { authedFetch } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateOrderInput) =>
      authedFetch<{ orderId: string }>('/pedidos', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    },
  })
}
