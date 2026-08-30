export type CommissionEligibleBusiness = {
  commissionOverrideEnabled: boolean
  commissionOverridePercent: number | null
  category: { commissionPercent: number | null }
}

export function getEffectiveCommissionPercent(business: CommissionEligibleBusiness): number | null {
  if (business.commissionOverrideEnabled) return business.commissionOverridePercent
  return business.category.commissionPercent
}
