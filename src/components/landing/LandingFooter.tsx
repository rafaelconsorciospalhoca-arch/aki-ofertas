import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="border-t border-neutral-100 bg-white px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
        <p className="text-sm font-bold text-neutral-900">
          Aki <span className="text-brand-green">Ofertas</span>
        </p>
        <div className="flex gap-6 text-xs font-semibold text-neutral-500">
          <Link href="/entrar">Entrar</Link>
          <Link href="/comerciante/cadastro">Cadastrar minha loja</Link>
        </div>
        <p className="text-[11px] text-neutral-400">© {new Date().getFullYear()} Aki Ofertas</p>
      </div>
    </footer>
  )
}
