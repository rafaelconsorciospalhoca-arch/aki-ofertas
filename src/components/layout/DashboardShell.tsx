'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS: Record<'comerciante' | 'admin', { href: string; label: string }[]> = {
  comerciante: [
    { href: '/comerciante', label: 'Dashboard' },
    { href: '/comerciante/ofertas', label: 'Ofertas' },
    { href: '/comerciante/cardapio', label: 'Cardápio' },
    { href: '/comerciante/cupons/validar', label: 'Validar cupom' },
    { href: '/comerciante/empresa', label: 'Empresa' },
    { href: '/comerciante/plano', label: 'Plano' },
  ],
  admin: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/usuarios', label: 'Usuários' },
    { href: '/admin/empresas', label: 'Empresas' },
    { href: '/admin/categorias', label: 'Categorias' },
    { href: '/admin/cidades', label: 'Cidades' },
    { href: '/admin/planos', label: 'Planos' },
  ],
}

export function DashboardShell({
  area,
  children,
}: {
  area: 'comerciante' | 'admin'
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="w-56 flex-shrink-0 bg-brand-navy p-4 text-white">
        <p className="mb-6 px-2 text-lg font-bold">
          Aki<span className="text-brand-green-light">Ofertas</span>
        </p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS[area].map((item) => {
            const active = item.href === `/${area}` ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-white/10 font-bold text-white' : 'text-neutral-300 hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
