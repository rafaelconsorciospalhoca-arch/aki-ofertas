import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOptionGroup, deleteOptionGroup, createOptionChoice, deleteOptionChoice } from '@/actions/offer-option-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    offer: { findFirst: vi.fn() },
    offerOptionGroup: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    offerOptionChoice: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}))

const business = { id: 'biz-1' }

describe('createOptionGroup', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await createOptionGroup({ offerId: 'offer-1', name: 'Sabor', type: 'SINGLE', required: true })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects when the offer does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue(null)

    const result = await createOptionGroup({ offerId: 'offer-of-another-biz', name: 'Sabor', type: 'SINGLE', required: true })
    expect(result).toEqual({ ok: false, error: 'Oferta não encontrada.' })
    expect(prisma.offerOptionGroup.create).not.toHaveBeenCalled()
  })

  it('creates the group', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offer.findFirst).mockResolvedValue({ id: 'offer-1', businessId: 'biz-1' } as never)
    vi.mocked(prisma.offerOptionGroup.create).mockResolvedValue({ id: 'group-1' } as never)

    const result = await createOptionGroup({ offerId: 'offer-1', name: 'Sabor', type: 'SINGLE', required: true })

    expect(result).toEqual({ ok: true, groupId: 'group-1' })
    expect(prisma.offerOptionGroup.create).toHaveBeenCalledWith({
      data: { offerId: 'offer-1', name: 'Sabor', type: 'SINGLE', required: true },
    })
  })
})

describe('deleteOptionGroup', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects deleting a group from another business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue(null)

    const result = await deleteOptionGroup('group-1')
    expect(result).toEqual({ ok: false, error: 'Grupo não encontrado.' })
    expect(prisma.offerOptionGroup.delete).not.toHaveBeenCalled()
  })

  it('deletes a group owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue({ id: 'group-1' } as never)

    const result = await deleteOptionGroup('group-1')
    expect(result).toEqual({ ok: true })
    expect(prisma.offerOptionGroup.delete).toHaveBeenCalledWith({ where: { id: 'group-1' } })
  })
})

describe('createOptionChoice', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the group does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue(null)

    const result = await createOptionChoice({ groupId: 'group-of-another-biz', name: 'Calabresa' })
    expect(result).toEqual({ ok: false, error: 'Grupo não encontrado.' })
  })

  it('creates a choice with zero extra price when none is given', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue({ id: 'group-1' } as never)
    vi.mocked(prisma.offerOptionChoice.create).mockResolvedValue({ id: 'choice-1' } as never)

    const result = await createOptionChoice({ groupId: 'group-1', name: 'Calabresa' })

    expect(result).toEqual({ ok: true, choiceId: 'choice-1' })
    expect(prisma.offerOptionChoice.create).toHaveBeenCalledWith({
      data: { groupId: 'group-1', name: 'Calabresa', extraPriceCents: 0 },
    })
  })

  it('creates a choice with a given extra price', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionGroup.findFirst).mockResolvedValue({ id: 'group-1' } as never)
    vi.mocked(prisma.offerOptionChoice.create).mockResolvedValue({ id: 'choice-1' } as never)

    const result = await createOptionChoice({ groupId: 'group-1', name: 'Bacon', extraPriceCents: '3.00' })

    expect(result).toEqual({ ok: true, choiceId: 'choice-1' })
    expect(prisma.offerOptionChoice.create).toHaveBeenCalledWith({
      data: { groupId: 'group-1', name: 'Bacon', extraPriceCents: 300 },
    })
  })
})

describe('deleteOptionChoice', () => {
  afterEach(() => vi.clearAllMocks())

  it('deletes a choice owned by the caller business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.offerOptionChoice.findFirst).mockResolvedValue({ id: 'choice-1' } as never)

    const result = await deleteOptionChoice('choice-1')
    expect(result).toEqual({ ok: true })
    expect(prisma.offerOptionChoice.delete).toHaveBeenCalledWith({ where: { id: 'choice-1' } })
  })
})
