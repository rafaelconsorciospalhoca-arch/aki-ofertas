import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getBusinessForOwner } from '@/lib/merchant'
import { AccountForm } from '@/components/merchant/AccountForm'
import { PasswordForm } from '@/components/merchant/PasswordForm'

export default async function ComercianteContaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  // Read the current name/email from the database rather than the session:
  // the NextAuth JWT session only captures these at sign-in and never
  // refreshes, so seeding the form from `session` would re-show (and on
  // save, silently restore) stale values after the account is edited.
  const owner = await prisma.user.findUnique({
    where: { id: business.ownerId },
    select: { name: true, email: true },
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Conta</h1>
      <AccountForm initialValues={{ name: owner!.name, email: owner!.email }} />
      <PasswordForm />
    </div>
  )
}
