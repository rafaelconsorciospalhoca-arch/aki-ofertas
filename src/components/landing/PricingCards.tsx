function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PERK_BY_PLAN_NAME: Record<string, string> = {
  Básico: 'Até 5 ofertas ativas',
  Destaque: 'Aparece também na página inicial + mais ofertas ativas',
  Turbo: 'Destaque no card grande da página inicial',
}

export function PricingCards({ plans }: { plans: { id: string; name: string; priceCents: number }[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-2xl bg-white/5 p-6 text-center">
          <p className="text-sm font-bold text-white">{plan.name}</p>
          <p className="mt-1 text-2xl font-extrabold text-brand-green-light">{formatPrice(plan.priceCents)}/mês</p>
          <p className="mt-3 text-sm text-neutral-300">{PERK_BY_PLAN_NAME[plan.name] ?? ''}</p>
        </div>
      ))}
    </div>
  )
}
