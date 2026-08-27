import Link from 'next/link'

export function LandingHeader() {
  return (
    <header className="border-b border-neutral-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-green">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" fill="#0A1830" />
              <circle cx="12" cy="9.5" r="2.4" fill="#fff" />
            </svg>
          </span>
          <p className="text-base font-bold leading-tight text-neutral-900">
            Aki <span className="text-brand-green">Ofertas</span>
          </p>
        </div>
        <Link href="/entrar" className="text-sm font-bold text-brand-navy">
          Entrar
        </Link>
      </div>
    </header>
  )
}
