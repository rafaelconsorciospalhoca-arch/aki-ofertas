'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function EntrarForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    if (result?.error) {
      setError('E-mail ou senha incorretos.')
      return
    }
    const raw = searchParams.get('callbackUrl')
    if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
      router.push(raw)
      return
    }

    const session = await getSession()
    const role = (session?.user as { role?: string } | undefined)?.role
    if (role === 'MERCHANT') {
      router.push('/comerciante')
    } else if (role === 'ADMIN') {
      router.push('/admin')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-xl font-bold">Entrar</h1>
      {searchParams.get('cadastro') === 'sucesso' && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Empresa cadastrada! Faça login para acessar seu painel.
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
        >
          Entrar
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        Tem uma empresa?{' '}
        <Link href="/comerciante/cadastro" className="font-bold text-brand-green">
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <EntrarForm />
    </Suspense>
  )
}
