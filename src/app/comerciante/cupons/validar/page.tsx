import { ValidateCouponForm } from '@/components/merchant/ValidateCouponForm'

export default function ValidarCupomPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Validar cupom</h1>
      <p className="text-sm text-neutral-500">
        Digite o código que o cliente mostrar para confirmar o resgate da oferta.
      </p>
      <ValidateCouponForm />
    </div>
  )
}
