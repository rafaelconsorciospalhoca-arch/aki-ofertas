const STEPS = [
  {
    title: 'Ative sua localização',
    description: 'Em segundos, sem precisar criar conta pra começar a olhar.',
    icon: (
      <>
        <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2" />
      </>
    ),
  },
  {
    title: 'Veja ofertas perto de você',
    description: 'Descontos reais de lojas, restaurantes e serviços da sua região.',
    icon: <path d="M4 6h16M4 12h16M4 18h10" />,
  },
  {
    title: 'Resgate o cupom na loja',
    description: 'Mostra o código (ou o QR code) no balcão e pronto.',
    icon: <rect x="4" y="6" width="16" height="12" rx="2" />,
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-extrabold text-neutral-900">Como funciona</h2>
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-green/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="#17A94E" strokeWidth={2} className="h-6 w-6">
                {step.icon}
              </svg>
            </span>
            <p className="mt-3 text-xs font-bold text-brand-green">Passo {index + 1}</p>
            <h3 className="mt-1 text-base font-bold text-neutral-900">{step.title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
