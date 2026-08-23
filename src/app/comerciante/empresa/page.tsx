import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveCategories } from '@/lib/categories'
import { getBusinessForOwner } from '@/lib/merchant'
import { BusinessProfileForm } from '@/components/merchant/BusinessProfileForm'

export default async function ComercianteEmpresaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  if (!business) {
    notFound()
  }

  const categories = await getActiveCategories()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Empresa</h1>
      <BusinessProfileForm
        categories={categories}
        initialValues={{
          name: business.name,
          categoryId: business.categoryId,
          description: business.description ?? '',
          phone: business.phone ?? '',
          whatsapp: business.whatsapp ?? '',
          email: business.email ?? '',
          instagram: business.instagram ?? '',
          website: business.website ?? '',
          address: business.address,
          number: business.number ?? '',
          neighborhood: business.neighborhood ?? '',
          city: business.city,
          state: business.state,
          zip: business.zip ?? '',
          logoUrl: business.logoUrl ?? '',
          coverUrl: business.coverUrl ?? '',
        }}
      />
    </div>
  )
}
