import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { MerchantAccessGate } from '@/components/merchant/MerchantAccessGate'
import { OrderNotificationWatcher } from '@/components/merchant/OrderNotificationWatcher'

export default async function ComercianteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const business = session?.user?.id ? await getBusinessForOwner(session.user.id as string) : null
  const suspended = business?.status === 'SUSPENDED'

  return (
    <DashboardShell area="comerciante">
      <MerchantAccessGate suspended={Boolean(suspended)} suspendedReason={business?.suspendedReason ?? null}>
        {!suspended && <OrderNotificationWatcher />}
        {children}
      </MerchantAccessGate>
    </DashboardShell>
  )
}
