import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getActiveCategories } from '@/lib/categories'
import { getBusinessForOwner, getOfferForOwner, getOfferOptionGroupsForOwner } from '@/lib/merchant'
import { centsToReais } from '@/lib/money'
import { OfferForm } from '@/components/merchant/OfferForm'
import { OfferOptionsManager } from '@/components/merchant/OfferOptionsManager'

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function EditarOfertaPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)
  if (!business) {
    notFound()
  }

  const offer = await getOfferForOwner(params.id, business.id)
  if (!offer) {
    notFound()
  }

  const categories = await getActiveCategories()
  const optionGroups = await getOfferOptionGroupsForOwner(offer.id)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Editar oferta</h1>
      <OfferForm
        categories={categories}
        offerId={offer.id}
        initialValues={{
          title: offer.title,
          description: offer.description ?? '',
          imageUrl: offer.imageUrl ?? '',
          originalPrice: centsToReais(offer.originalPrice),
          discountPrice: centsToReais(offer.discountPrice),
          categoryId: offer.categoryId,
          quantityAvailable: offer.quantityAvailable !== null ? String(offer.quantityAvailable) : '',
          startDate: toDateInputValue(offer.startDate),
          endDate: toDateInputValue(offer.endDate),
          deliveryEnabled: offer.deliveryEnabled,
          customCouponCode: offer.customCouponCode ?? '',
        }}
      />
      <OfferOptionsManager offerId={offer.id} groups={optionGroups} />
    </div>
  )
}
