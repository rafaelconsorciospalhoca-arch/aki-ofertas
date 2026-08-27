import Link from 'next/link'
import { Benefits } from './Benefits'
import { PricingCards } from './PricingCards'

export function MerchantSection() {
  return (
    <section className="bg-brand-navy-dark px-4 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start gap-4 md:items-center md:text-center">
          <h2 className="text-2xl font-extrabold">Tem uma loja ou restaurante?</h2>
          <p className="max-w-xl text-sm text-neutral-300">
            Publique ofertas, gerencie pedidos e alcance clientes que estão pertinho de você.
          </p>
          <Benefits />
          <Link
            href="/comerciante/cadastro"
            className="mt-2 rounded-lg bg-brand-green px-6 py-3 text-sm font-bold text-brand-navy"
          >
            Cadastrar minha loja
          </Link>
        </div>

        <div className="mt-12">
          <PricingCards />
        </div>
      </div>
    </section>
  )
}
