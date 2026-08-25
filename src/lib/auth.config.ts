import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-safe NextAuth config: no providers with Node-only dependencies
 * (Credentials provider uses Prisma via the `pg` adapter, which needs
 * Node's `crypto`/native bindings and cannot run in the Edge runtime).
 *
 * `src/middleware.ts` runs in the Edge runtime and only needs to decode
 * the session JWT to read `role` for route protection, so it builds its
 * own NextAuth instance from this config (no providers, same callbacks).
 * `src/lib/auth.ts` spreads this config and adds the full Credentials
 * provider for use in Server Components, Route Handlers, and Server
 * Actions (Node runtime).
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/entrar' },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = (user as { role: string }).role
      }
      return token
    },
    session: ({ session, token }) => {
      if (session.user) {
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { id?: string }).id = token.sub
      }
      return session
    },
  },
} satisfies NextAuthConfig
