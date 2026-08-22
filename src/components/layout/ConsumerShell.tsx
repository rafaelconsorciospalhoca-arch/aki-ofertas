import Link from 'next/link'

export function ConsumerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="flex-1 pb-16">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-neutral-200 bg-white py-2 text-xs text-neutral-500">
        <Link href="/" className="flex flex-col items-center gap-1 px-3 py-1">
          Início
        </Link>
        <Link href="/cupons" className="flex flex-col items-center gap-1 px-3 py-1">
          Cupons
        </Link>
        <Link href="/favoritos" className="flex flex-col items-center gap-1 px-3 py-1">
          Favoritos
        </Link>
        <Link href="/perfil" className="flex flex-col items-center gap-1 px-3 py-1">
          Perfil
        </Link>
      </nav>
    </div>
  )
}
