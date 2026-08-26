import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMenuItem, updateMenuItem, deleteMenuItem } from '@/actions/menu-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    menuItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

const validInput = { name: 'X-Burger', description: 'Com bacon', price: '29.90', imageUrl: '' }

describe('createMenuItem', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when there is no merchant business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null)

    const result = await createMenuItem(validInput)
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid price', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)

    const result = await createMenuItem({ ...validInput, price: 'abc' })
    expect(result).toEqual({ ok: false, error: 'Informe um preço válido.' })
    expect(prisma.menuItem.create).not.toHaveBeenCalled()
  })

  it('creates the item, appending it after the last order', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({ order: 2 } as never)
    vi.mocked(prisma.menuItem.create).mockResolvedValue({ id: 'item-1' } as never)

    const result = await createMenuItem(validInput)

    expect(result).toEqual({ ok: true, menuItemId: 'item-1' })
    expect(prisma.menuItem.create).toHaveBeenCalledWith({
      data: { businessId: 'biz-1', name: 'X-Burger', description: 'Com bacon', price: 2990, imageUrl: null, order: 3 },
    })
  })

  it('allows an item with no price', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.menuItem.create).mockResolvedValue({ id: 'item-1' } as never)

    const result = await createMenuItem({ ...validInput, price: '' })

    expect(result).toEqual({ ok: true, menuItemId: 'item-1' })
    expect(prisma.menuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: null, order: 0 }) }),
    )
  })
})

describe('updateMenuItem', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the item does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(null)

    const result = await updateMenuItem('item-1', validInput)
    expect(result).toEqual({ ok: false, error: 'Item não encontrado.' })
  })

  it('updates the item', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({ id: 'item-1' } as never)
    vi.mocked(prisma.menuItem.update).mockResolvedValue({ id: 'item-1' } as never)

    const result = await updateMenuItem('item-1', validInput)

    expect(result).toEqual({ ok: true, menuItemId: 'item-1' })
    expect(prisma.menuItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { name: 'X-Burger', description: 'Com bacon', price: 2990, imageUrl: null },
    })
  })
})

describe('deleteMenuItem', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when the item does not belong to this business', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue(null)

    const result = await deleteMenuItem('item-1')
    expect(result).toEqual({ ok: false, error: 'Item não encontrado.' })
  })

  it('deletes the item', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue({ id: 'biz-1' } as never)
    vi.mocked(prisma.menuItem.findFirst).mockResolvedValue({ id: 'item-1' } as never)

    const result = await deleteMenuItem('item-1')

    expect(result).toEqual({ ok: true })
    expect(prisma.menuItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
  })
})
