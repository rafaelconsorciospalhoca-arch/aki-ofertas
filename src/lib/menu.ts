import { prisma } from '@/lib/db'

export type MenuItemRow = {
  id: string
  name: string
  description: string | null
  price: number | null
  imageUrl: string | null
}

export async function getMenuItemsForBusinessSlug(slug: string): Promise<MenuItemRow[] | null> {
  const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } })
  if (!business) return null

  const rows = await prisma.menuItem.findMany({
    where: { businessId: business.id, active: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    imageUrl: row.imageUrl,
  }))
}
