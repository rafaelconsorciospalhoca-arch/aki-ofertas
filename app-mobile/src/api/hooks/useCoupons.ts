import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import type { CouponRow } from '@/api/types'

export function useCoupons() {
  const { token, authedFetch } = useAuth()
  return useQuery({
    queryKey: ['cupons'],
    queryFn: () => authedFetch<CouponRow[]>('/cupons'),
    enabled: token !== null,
  })
}
