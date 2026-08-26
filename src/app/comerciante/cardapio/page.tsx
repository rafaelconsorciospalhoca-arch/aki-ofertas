import { auth } from '@/lib/auth'
import { getBusinessForOwner, getMenuItemsForOwner } from '@/lib/merchant'
import { MenuManager } from '@/components/merchant/MenuManager'

export default async function ComercianteCardapioPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const items = await getMenuItemsForOwner(business.id)

  return <MenuManager items={items} />
}
