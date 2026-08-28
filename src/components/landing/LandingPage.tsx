import { LandingHeader } from './LandingHeader'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { CategoriesShowcase } from './CategoriesShowcase'
import { CitiesShowcase } from './CitiesShowcase'
import { MerchantSection } from './MerchantSection'
import { LandingFooter } from './LandingFooter'

export function LandingPage({
  categories,
  cities,
  plans,
}: {
  categories: { id: string; name: string; icon: string }[]
  cities: { name: string; state: string }[]
  plans: { id: string; name: string; priceCents: number }[]
}) {
  return (
    <div className="landing-page flex flex-col">
      <LandingHeader />
      <Hero />
      <HowItWorks />
      <CategoriesShowcase categories={categories} />
      <CitiesShowcase cities={cities} />
      <MerchantSection plans={plans} />
      <LandingFooter />
    </div>
  )
}
