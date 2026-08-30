import type { CommissionInvoiceRow } from '@/lib/commission-invoices'

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Atrasado' }
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CommissionPanel({ percent, invoices }: { percent: number; invoices: CommissionInvoiceRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Seu ramo cobra <strong>{percent}%</strong> de comissão sobre o valor vendido em pedidos com entrega, em vez de
        mensalidade. Toda segunda-feira geramos a cobrança referente à semana anterior.
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma cobrança gerada ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Semana</th>
                <th className="px-4 py-2">Valor vendido</th>
                <th className="px-4 py-2">Comissão</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-neutral-600">
                    {formatDate(invoice.weekStart)} – {formatDate(invoice.weekEnd)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{formatCents(invoice.salesCents)}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{formatCents(invoice.feeCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[invoice.status]}`}>
                      {STATUS_LABEL[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {invoice.payUrl && (
                      <a href={invoice.payUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-green">
                        Pagar
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
