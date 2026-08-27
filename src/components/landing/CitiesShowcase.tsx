export function CitiesShowcase({ cities }: { cities: { name: string; state: string }[] }) {
  if (cities.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="text-center text-2xl font-extrabold text-neutral-900">Onde a gente já está</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {cities.map((city) => (
          <span
            key={`${city.name}-${city.state}`}
            className="rounded-full bg-brand-green/10 px-4 py-2 text-sm font-semibold text-brand-green"
          >
            {city.name} - {city.state}
          </span>
        ))}
      </div>
    </section>
  )
}
