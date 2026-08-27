const BENEFITS = [
  'Alcance clientes perto da sua loja',
  'Painel de pedidos e cupons, sem complicação',
  'Cadastro rápido, sem burocracia',
]

export function Benefits() {
  return (
    <ul className="flex flex-col gap-3">
      {BENEFITS.map((benefit) => (
        <li key={benefit} className="flex items-start gap-2.5 text-sm text-neutral-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2.5} className="mt-0.5 h-4 w-4 flex-shrink-0">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {benefit}
        </li>
      ))}
    </ul>
  )
}
