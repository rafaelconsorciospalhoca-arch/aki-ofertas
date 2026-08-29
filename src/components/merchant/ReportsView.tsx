import type { OfferCouponStats, MerchantCouponRow } from '@/lib/coupons'

const STATUS_LABEL: Record<MerchantCouponRow['status'], string> = {
  VALID: 'Válido',
  USED: 'Usado',
  EXPIRED: 'Expirado',
}

const STATUS_COLOR: Record<MerchantCouponRow['status'], string> = {
  VALID: 'bg-emerald-100 text-emerald-700',
  USED: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function conversionLabel(generated: number, used: number): string {
  if (generated === 0) return '—'
  return `${Math.round((used / generated) * 100)}%`
}

export function ReportsView({ stats, coupons }: { stats: OfferCouponStats[]; coupons: MerchantCouponRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Relatórios</h1>
        <p className="text-sm text-neutral-500">Acompanhe o desempenho dos seus cupons.</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-neutral-900">Resumo por oferta</h2>
        {stats.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum cupom gerado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Oferta</th>
                  <th className="px-4 py-2">Gerados</th>
                  <th className="px-4 py-2">Usados</th>
                  <th className="px-4 py-2">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.offerId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">{row.offerTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.generated}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.used}</td>
                    <td className="px-4 py-3 text-neutral-600">{conversionLabel(row.generated, row.used)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-neutral-900">Histórico de cupons</h2>
        {coupons.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum cupom gerado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Oferta</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Gerado em</th>
                  <th className="px-4 py-2">Usado em</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-900">{coupon.code}</td>
                    <td className="px-4 py-3 text-neutral-600">{coupon.offerTitle}</td>
                    <td className="px-4 py-3 text-neutral-600">{coupon.customerName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[coupon.status]}`}>
                        {STATUS_LABEL[coupon.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{formatDate(coupon.generatedAt)}</td>
                    <td className="px-4 py-3 text-neutral-600">{coupon.usedAt ? formatDate(coupon.usedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
