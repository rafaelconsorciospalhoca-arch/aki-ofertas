import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/admin'
import { UserForm } from '@/components/admin/UserForm'

export default async function EditarUsuarioPage({ params }: { params: { id: string } }) {
  const user = await getUserById(params.id)
  if (!user) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Editar usuário</h1>
        <p className="text-sm text-neutral-500">{user.email}</p>
      </div>
      <UserForm
        userId={user.id}
        initialValues={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
          city: user.city ?? '',
          state: user.state ?? '',
        }}
      />
    </div>
  )
}
