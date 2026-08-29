import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { getCouponsForBusiness, getCouponStatsForBusiness } from '@/lib/coupons'
import { ReportsView } from '@/components/merchant/ReportsView'

export default async function ComercianteRelatoriosPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  const [stats, coupons] = await Promise.all([
    getCouponStatsForBusiness(business.id),
    getCouponsForBusiness(business.id),
  ])

  return <ReportsView stats={stats} coupons={coupons} />
}
