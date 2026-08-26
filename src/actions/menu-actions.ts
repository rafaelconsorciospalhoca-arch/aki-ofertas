'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { reaisToCents } from '@/lib/money'

const menuItemSchema = z.object({
  name: z.string().min(2, 'Informe o nome do item.'),
  description: z.string().optional(),
  price: z.string().optional(),
  imageUrl: z.string().url('URL inválida.').optional().or(z.literal('')),
})

type MenuItemInput = z.infer<typeof menuItemSchema>
type MenuItemResult = { ok: true; menuItemId: string } | { ok: false; error: string }

function parsePriceToCents(price: string | undefined): number | null {
  if (!price) return null
  return reaisToCents(price)
}

export async function createMenuItem(input: MenuItemInput): Promise<MenuItemResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = menuItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const price = parsePriceToCents(parsed.data.price)
  if (parsed.data.price && price === null) {
    return { ok: false, error: 'Informe um preço válido.' }
  }

  const lastItem = await prisma.menuItem.findFirst({ where: { businessId: business.id }, orderBy: { order: 'desc' } })

  const item = await prisma.menuItem.create({
    data: {
      businessId: business.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price,
      imageUrl: parsed.data.imageUrl || null,
      order: (lastItem?.order ?? -1) + 1,
    },
  })

  return { ok: true, menuItemId: item.id }
}

export async function updateMenuItem(menuItemId: string, input: MenuItemInput): Promise<MenuItemResult> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.menuItem.findFirst({ where: { id: menuItemId, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Item não encontrado.' }
  }

  const parsed = menuItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const price = parsePriceToCents(parsed.data.price)
  if (parsed.data.price && price === null) {
    return { ok: false, error: 'Informe um preço válido.' }
  }

  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      price,
      imageUrl: parsed.data.imageUrl || null,
    },
  })

  return { ok: true, menuItemId }
}

export async function deleteMenuItem(menuItemId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const existing = await prisma.menuItem.findFirst({ where: { id: menuItemId, businessId: business.id } })
  if (!existing) {
    return { ok: false, error: 'Item não encontrado.' }
  }

  await prisma.menuItem.delete({ where: { id: menuItemId } })

  return { ok: true }
}
