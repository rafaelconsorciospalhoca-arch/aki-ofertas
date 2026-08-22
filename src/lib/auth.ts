import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { authConfig } from '@/lib/auth.config'

// WARNING: `{...authConfig, ...}` is a shallow spread, not a deep merge.
// If you add a top-level `callbacks: {...}` key directly in this
// NextAuth(...) call, it will silently REPLACE (not merge with) the
// `jwt`/`session` callbacks spread in from `authConfig` below, and the
// `role` field will silently stop being threaded into the session/JWT
// (no type error). Any new/changed callback must be added inside
// `authConfig.callbacks` in `src/lib/auth.config.ts` instead, so
// `src/middleware.ts` (which builds its own NextAuth instance from
// `authConfig`) stays in sync with this file.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],
})
