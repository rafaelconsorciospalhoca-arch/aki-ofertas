'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MESSAGE: Record<string, { title: string; body: string; showCta: boolean }> = {
  TRIAL_EXPIRED: {
    title: 'Seu período de teste terminou',
    body: 'Assine um plano pra continuar publicando ofertas e acessando o painel.',
    showCta: true,
  },
  PAYMENT_OVERDUE: {
    title: 'Assinatura em atraso',
    body: 'Regularize o pagamento pra voltar a acessar o painel.',
    showCta: true,
  },
  ADMIN: {
    title: 'Conta suspensa',
    body: 'Sua conta foi suspensa. Entre em contato com o suporte pra mais informações.',
    showCta: false,
  },
}

export function MerchantAccessGate({
  suspended,
  suspendedReason,
  children,
}: {
  suspended: boolean
  suspendedReason: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (!suspended || pathname === '/comerciante/plano') {
    return <>{children}</>
  }

  const message = MESSAGE[suspendedReason ?? ''] ?? MESSAGE.TRIAL_EXPIRED

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-8 text-center">
      <h1 className="text-lg font-bold text-neutral-900">{message.title}</h1>
      <p className="max-w-sm text-sm text-neutral-500">{message.body}</p>
      {message.showCta && (
        <Link href="/comerciante/plano" className="mt-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-bold text-white">
          Ver planos
        </Link>
      )}
    </div>
  )
}
