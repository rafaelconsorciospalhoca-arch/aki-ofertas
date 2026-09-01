import { CreateUserForm } from '@/components/admin/CreateUserForm'

export default function AdminNovoUsuarioPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Novo usuário</h1>
      <CreateUserForm />
    </div>
  )
}
