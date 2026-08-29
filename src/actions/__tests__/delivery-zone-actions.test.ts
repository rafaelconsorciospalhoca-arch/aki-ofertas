import { afterEach, describe, expect, it, vi } from 'vitest'
import { upsertDeliveryZone, deleteDeliveryZone, toggleDeliveryZoneActive } from '@/actions/delivery-zone-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    deliveryZone: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  },
}))

const business = { id: 'biz-1' }

describe('upsertDeliveryZone', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await upsertDeliveryZone({ neighborhood: 'Centro', feeCents: '5.00' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an all-whitespace neighborhood instead of silently trimming it', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    const result = await upsertDeliveryZone({ neighborhood: '  ', feeCents: '5.00' })
    expect(result).toEqual({ ok: false, error: 'Informe o nome do bairro.' })
    expect(prisma.deliveryZone.upsert).not.toHaveBeenCalled()
  })

  it('rejects an invalid fee', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    const result = await upsertDeliveryZone({ neighborhood: 'Centro', feeCents: 'abc' })
    expect(result).toEqual({ ok: false, error: 'Informe um valor de taxa válido.' })
  })

  it('creates a new zone via upsert keyed by business+neighborhood', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.upsert).mockResolvedValue({ id: 'zone-1' } as never)

    const result = await upsertDeliveryZone({ neighborhood: 'Centro', feeCents: '5.00' })

    expect(result).toEqual({ ok: true, zoneId: 'zone-1' })
    expect(prisma.deliveryZone.upsert).toHaveBeenCalledWith({
      where: { businessId_neighborhood: { businessId: 'biz-1', neighborhood: 'Centro' } },
      update: { feeCents: 500, active: true },
      create: { businessId: 'biz-1', neighborhood: 'Centro', feeCents: 500 },
    })
  })

  it('updates an existing zone by id, scoped to the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.deliveryZone.update).mockResolvedValue({ id: 'zone-1' } as never)

    const result = await upsertDeliveryZone({ id: 'zone-1', neighborhood: 'Centro', feeCents: '7.50' })

    expect(result).toEqual({ ok: true, zoneId: 'zone-1' })
    expect(prisma.deliveryZone.update).toHaveBeenCalledWith({
      where: { id: 'zone-1' },
      data: { neighborhood: 'Centro', feeCents: 750 },
    })
  })

  it('rejects updating a zone that does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue(null)

    const result = await upsertDeliveryZone({ id: 'zone-of-another-biz', neighborhood: 'Centro', feeCents: '5.00' })
    expect(result).toEqual({ ok: false, error: 'Bairro não encontrado.' })
    expect(prisma.deliveryZone.update).not.toHaveBeenCalled()
  })
})

describe('deleteDeliveryZone', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects deleting a zone from another business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue(null)

    const result = await deleteDeliveryZone('zone-1')
    expect(result).toEqual({ ok: false, error: 'Bairro não encontrado.' })
    expect(prisma.deliveryZone.delete).not.toHaveBeenCalled()
  })

  it('deletes a zone owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', businessId: 'biz-1' } as never)

    const result = await deleteDeliveryZone('zone-1')
    expect(result).toEqual({ ok: true })
    expect(prisma.deliveryZone.delete).toHaveBeenCalledWith({ where: { id: 'zone-1' } })
  })
})

describe('toggleDeliveryZoneActive', () => {
  afterEach(() => vi.clearAllMocks())

  it('toggles active state for a zone owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.deliveryZone.findFirst).mockResolvedValue({ id: 'zone-1', businessId: 'biz-1' } as never)

    const result = await toggleDeliveryZoneActive('zone-1', false)
    expect(result).toEqual({ ok: true })
    expect(prisma.deliveryZone.update).toHaveBeenCalledWith({ where: { id: 'zone-1' }, data: { active: false } })
  })
})
