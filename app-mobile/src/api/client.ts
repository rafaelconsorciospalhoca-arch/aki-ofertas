export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://akiofertas.com.br'

type ApiFetchOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(`${BASE_URL}/api/mobile${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const json = await response.json().catch(() => null)

  if (!json || json.ok !== true) {
    throw new ApiError(json?.error ?? 'Erro ao conectar com o servidor.', response.status)
  }

  return ('data' in json ? json.data : json) as T
}
