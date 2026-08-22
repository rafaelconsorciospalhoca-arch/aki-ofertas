import { getActiveCities } from '@/lib/categories'
import { LocationGate } from '@/components/onboarding/LocationGate'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const cities = await getActiveCities()
  return <LocationGate cities={cities} />
}
