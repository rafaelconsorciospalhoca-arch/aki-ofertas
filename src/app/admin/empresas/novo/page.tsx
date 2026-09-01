import { getActiveCategories, getActiveCities } from '@/lib/categories'
import { MerchantSignupForm } from '@/components/merchant/MerchantSignupForm'

export default async function AdminNovaEmpresaPage() {
  const [categories, cities] = await Promise.all([getActiveCategories(), getActiveCities()])

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Nova empresa</h1>
        <p className="text-sm text-neutral-500">
          Cadastra a conta do dono e a empresa juntas, do mesmo jeito que o cadastro público. A empresa entra como
          &quot;Aguardando aprovação&quot; — aprove em Empresas depois de criar.
        </p>
      </div>
      <MerchantSignupForm categories={categories} cities={cities} redirectTo="/admin/empresas?status=PENDING" />
    </div>
  )
}
