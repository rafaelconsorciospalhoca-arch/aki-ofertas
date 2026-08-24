import Link from 'next/link'
import { getAllCities } from '@/lib/admin'

export default async function AdminCidadesPage() {
  const cities = await getAllCities()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Cidades</h1>
        <Link href="/admin/cidades/nova" className="rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white">
          + Nova cidade
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Cidade</th>
              <th className="px-4 py-2">UF</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => (
              <tr key={city.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">{city.name}</td>
                <td className="px-4 py-3 text-neutral-600">{city.state}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      city.active
                        ? 'bg-emerald-100 text-emerald-700'
                        : city.comingSoon
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {city.active ? 'Ativa' : city.comingSoon ? 'Em breve' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/cidades/${city.id}`} className="text-xs font-bold text-brand-green">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
