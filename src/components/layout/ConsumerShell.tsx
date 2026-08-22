'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Início',
    icon: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  },
  {
    href: '/cupons',
    label: 'Cupons',
    icon: <rect x="4" y="6" width="16" height="12" rx="2" />,
  },
  {
    href: '/favoritos',
    label: 'Favoritos',
    icon: <path d="M12 21s-7-5-7-11a5 5 0 0 1 10 0 5 5 0 0 1 10 0c0 6-7 11-7 11z" />,
  },
  {
    href: '/perfil',
    label: 'Perfil',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
]

export function ConsumerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="flex-1 pb-16">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex justify-around border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium ${
                active ? 'text-brand-green' : 'text-neutral-400'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} className="h-5 w-5">
                {item.icon}
              </svg>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
