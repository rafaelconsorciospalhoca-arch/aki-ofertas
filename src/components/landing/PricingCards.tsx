const PLANS = [
  {
    name: 'Básico',
    priceLabel: 'R$ 49,90/mês',
    perk: 'Até 5 ofertas ativas',
  },
  {
    name: 'Destaque',
    priceLabel: 'R$ 99,90/mês',
    perk: 'Aparece também na página inicial + mais ofertas ativas',
  },
  {
    name: 'Turbo',
    priceLabel: 'R$ 199,90/mês',
    perk: 'Destaque no card grande da página inicial',
  },
]

export function PricingCards() {
  return (
    <div>
      <p className="mb-4 text-center text-xs font-bold uppercase tracking-wide text-brand-green-light">
        Em breve — cadastro grátis por enquanto
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.name} className="rounded-2xl bg-white/5 p-6 text-center">
            <p className="text-sm font-bold text-white">{plan.name}</p>
            <p className="mt-1 text-2xl font-extrabold text-brand-green-light">{plan.priceLabel}</p>
            <p className="mt-3 text-sm text-neutral-300">{plan.perk}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
