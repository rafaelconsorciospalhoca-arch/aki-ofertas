import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateOrderStatus } from '@/actions/order-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { updateOrderStatusForBusiness } from '@/lib/orders'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/orders', () => ({ updateOrderStatusForBusiness: vi.fn() }))

describe('updateOrderStatus', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when there is no merchant business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null)

    const result = await updateOrderStatus('order-1', 'CONFIRMED')
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
    expect(updateOrderStatusForBusiness).not.toHaveBeenCalled()
  })

  it('rejects an invalid status value', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await updateOrderStatus('order-1', 'NOT_A_STATUS')
    expect(result).toEqual({ ok: false, error: 'Status inválido.' })
    expect(updateOrderStatusForBusiness).not.toHaveBeenCalled()
  })

  it('delegates to updateOrderStatusForBusiness scoped to the merchant business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(updateOrderStatusForBusiness).mockResolvedValue({ ok: true })

    const result = await updateOrderStatus('order-1', 'CONFIRMED')

    expect(result).toEqual({ ok: true })
    expect(updateOrderStatusForBusiness).toHaveBeenCalledWith('biz-1', 'order-1', 'CONFIRMED')
  })
})
