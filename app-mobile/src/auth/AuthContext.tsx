// app-mobile/src/auth/AuthContext.tsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as kv from '@/storage/kv'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiError } from '@/api/client'

const TOKEN_KEY = 'aki_token'

export type AuthUser = { id: string; name: string; email: string }

type AuthedFetchOptions = { method?: string; body?: unknown }

type AuthContextValue = {
  token: string | null
  user: AuthUser | null
  loading: boolean
  login: (token: string, user: AuthUser) => Promise<void>
  logout: () => Promise<void>
  authedFetch: <T>(path: string, options?: AuthedFetchOptions) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    kv.getItemAsync(TOKEN_KEY).then((stored) => {
      setToken(stored)
      setLoading(false)
    })
  }, [])

  const login = useCallback(
    async (newToken: string, newUser: AuthUser) => {
      await kv.setItemAsync(TOKEN_KEY, newToken)
      setToken(newToken)
      setUser(newUser)
      // Descarta dados em cache de outra identidade.
      queryClient.clear()
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    await kv.deleteItemAsync(TOKEN_KEY)
    setToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const authedFetch = useCallback(
    async <T,>(path: string, options: AuthedFetchOptions = {}): Promise<T> => {
      try {
        return await apiFetch<T>(path, { ...options, token })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await logout()
        }
        throw err
      }
    },
    [token, logout],
  )

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, authedFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
