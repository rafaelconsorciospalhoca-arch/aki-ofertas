// The default plan assigned at signup (src/actions/merchant-actions.ts):
// no monthly fee, but every delivery sale is billed this % via the weekly
// commission run (src/lib/weekly-commission.ts). Businesses who upgrade to
// a flat-fee plan (Básico/Destaque/Turbo) leave this plan and stop owing
// commission — see subscribeToPlan.
export const DELIVERY_PLAN_NAME = 'Delivery'
export const DELIVERY_COMMISSION_PERCENT = 10

export type CommissionEligibleBusiness = {
  commissionOverrideEnabled: boolean
  commissionOverridePercent: number | null
  category: { commissionPercent: number | null }
}

export function getEffectiveCommissionPercent(business: CommissionEligibleBusiness): number | null {
  if (business.commissionOverrideEnabled) return business.commissionOverridePercent
  return business.category.commissionPercent
}

// A business on the Delivery plan (commissionOverrideEnabled) is meant to
// pay its 10% commission ON TOP of any paid plan it later adds (e.g.
// Destaque, to unlock the featured carousel) — commission and a flat
// monthly fee stack for them, they are not mutually exclusive. Only a
// business whose commission comes purely from its category default (no
// override, likely a legacy/manually-set case) gets the older behavior of
// skipping the Asaas subscription payment / suspension-for-nonpayment,
// since it was never charged separately in the first place.
export function hasCategoryOnlyCommission(business: CommissionEligibleBusiness): boolean {
  return !business.commissionOverrideEnabled && business.category.commissionPercent !== null
}
