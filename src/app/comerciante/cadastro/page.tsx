import { getActiveCategories, getActiveCities } from '@/lib/categories'
import { MerchantSignupForm } from '@/components/merchant/MerchantSignupForm'

export default async function ComercianteCadastroPage() {
  const [categories, cities] = await Promise.all([getActiveCategories(), getActiveCities()])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="mb-1 text-xl font-bold text-neutral-900">Cadastre sua empresa</h1>
      <p className="mb-6 text-sm text-neutral-500">Publique ofertas e alcance clientes perto de você.</p>
      <MerchantSignupForm categories={categories} cities={cities} />
    </div>
  )
}
