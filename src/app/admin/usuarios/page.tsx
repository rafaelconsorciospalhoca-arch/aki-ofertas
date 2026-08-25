import Link from 'next/link'
import { getUsersForAdmin } from '@/lib/admin'
import { UserBlockToggle } from '@/components/admin/UserBlockToggle'

const ROLE_LABEL: Record<string, string> = {
  CONSUMER: 'Consumidor',
  MERCHANT: 'Comerciante',
  ADMIN: 'Administrador',
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const users = await getUsersForAdmin(searchParams.q)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Usuários</h1>

      <form method="GET" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar por nome ou e-mail"
          className="w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white">
          Buscar
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum usuário encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <p className="text-sm font-bold text-neutral-900">{user.name}</p>
                <p className="text-xs text-neutral-500">{user.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                    {ROLE_LABEL[user.role]}
                  </span>
                  {user.blocked && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      Bloqueado
                    </span>
                  )}
                  <Link href={`/admin/usuarios/${user.id}`} className="text-xs font-bold text-brand-green">
                    Editar
                  </Link>
                </div>
              </div>
              <UserBlockToggle userId={user.id} blocked={user.blocked} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
