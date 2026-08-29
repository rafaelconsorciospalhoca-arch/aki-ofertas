import { auth } from '@/lib/auth'
import { getBusinessForOwner } from '@/lib/merchant'
import { AccountForm } from '@/components/merchant/AccountForm'
import { PasswordForm } from '@/components/merchant/PasswordForm'

export default async function ComercianteContaPage() {
  const session = await auth()
  const business = await getBusinessForOwner(session!.user!.id as string)

  if (!business) {
    return <p className="text-sm text-neutral-500">Nenhuma empresa encontrada para esta conta.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Conta</h1>
      <AccountForm initialValues={{ name: session!.user!.name as string, email: session!.user!.email as string }} />
      <PasswordForm />
    </div>
  )
}
