import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'

// Middleware runs in the Edge runtime and must not import `@/lib/auth`
// directly: that module pulls in Prisma (via the Credentials provider's
// `authorize`), which needs Node's `crypto`/native bindings and crashes
// the Edge bundle. Build a separate, edge-safe NextAuth instance here
// from the shared `authConfig` (no providers) — it only needs to decode
// the session JWT to read `role`, which doesn't require a provider.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const role = (req.auth?.user as { role?: string } | undefined)?.role

  const isMerchantSignup = pathname === '/comerciante/cadastro'
  const isMerchantArea = pathname.startsWith('/comerciante') && !isMerchantSignup
  const isAdminArea = pathname.startsWith('/admin')

  if ((isMerchantArea || isAdminArea) && !req.auth) {
    const signInUrl = new URL('/entrar', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (isMerchantArea && role !== 'MERCHANT') {
    return NextResponse.redirect(new URL('/?erro=acesso-negado', req.nextUrl.origin))
  }

  if (isAdminArea && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/?erro=acesso-negado', req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/comerciante/:path*', '/admin/:path*'],
}
