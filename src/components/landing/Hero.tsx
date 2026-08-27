import Link from 'next/link'

export function Hero() {
  return (
    <section className="bg-brand-navy px-4 py-14 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 md:items-center md:text-center">
        <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">
          Ofertas boas, <span className="text-brand-green-light">pertinho de você</span>
        </h1>
        <p className="max-w-xl text-sm text-neutral-300 md:text-base">
          Descubra descontos de verdade em lojas, restaurantes e serviços perto de onde você está —
          e resgate o cupom direto no balcão.
        </p>
        <Link
          href="/onboarding"
          className="mt-2 rounded-lg bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy"
        >
          Ver ofertas perto de mim
        </Link>
      </div>
    </section>
  )
}
