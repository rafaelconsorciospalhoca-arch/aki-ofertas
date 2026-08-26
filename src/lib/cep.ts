export type CepResult = { street: string; neighborhood: string; city: string; state: string }

/** Looks up a Brazilian CEP via ViaCEP. Returns null on an invalid/unknown CEP or network failure. */
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.erro) return null

    return {
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}
