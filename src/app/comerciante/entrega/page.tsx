import { auth } from '@/lib/auth'
import { getBusinessForOwner, getDeliveryZonesForOwner, getBusinessHoursForOwner } from '@/lib/merchant'
import { DeliveryZoneManager } from '@/components/merchant/DeliveryZoneManager'
import { PaymentMethodsManager } from '@/components/merchant/PaymentMethodsManager'
import { BusinessHoursManager } from '@/components/merchant/BusinessHoursManager'

export default async function ComercianteEntregaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const [zones, hours] = await Promise.all([
    getDeliveryZonesForOwner(business.id),
    getBusinessHoursForOwner(business.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <BusinessHoursManager hours={hours} />
      <DeliveryZoneManager zones={zones} />
      <PaymentMethodsManager acceptedPaymentMethods={business.acceptedPaymentMethods} />
    </div>
  )
}
