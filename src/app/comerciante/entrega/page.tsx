import { auth } from '@/lib/auth'
import { getBusinessForOwner, getDeliveryZonesForOwner } from '@/lib/merchant'
import { DeliveryZoneManager } from '@/components/merchant/DeliveryZoneManager'

export default async function ComercianteEntregaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const zones = await getDeliveryZonesForOwner(business.id)

  return <DeliveryZoneManager zones={zones} />
}
