import { afterEach, describe, expect, it, vi } from 'vitest'
import { signUpConsumer } from '@/actions/auth-actions'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('signUpConsumer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid email', async () => {
    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'not-an-email',
      password: 'senha1234',
    })
    expect(result).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects a password shorter than 8 characters', async () => {
    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'rafael@example.com',
      password: '1234567',
    })
    expect(result).toEqual({ ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.' })
  })

  it('rejects a duplicate email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'rafael@example.com',
      password: 'senha1234',
    })
    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
  })

  it('creates the user with a hashed password on success', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-user-id' } as never)

    const result = await signUpConsumer({
      name: 'Rafael',
      email: 'rafael@example.com',
      password: 'senha1234',
      city: 'Marmeleiro',
      state: 'PR',
    })

    expect(result).toEqual({ ok: true, userId: 'new-user-id' })
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    expect(createCall.data.email).toBe('rafael@example.com')
    expect(createCall.data.passwordHash).not.toBe('senha1234')
    expect(createCall.data.role).toBe('CONSUMER')
  })

  it('normalizes the email case and whitespace before the check and the insert', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'new-user-id' } as never)

    const result = await signUpConsumer({
      name: 'Maria',
      email: ' Maria@Gmail.com ',
      password: 'senha1234',
    })

    expect(result).toEqual({ ok: true, userId: 'new-user-id' })
    expect(vi.mocked(prisma.user.findUnique).mock.calls[0][0].where.email).toBe('maria@gmail.com')
    expect(vi.mocked(prisma.user.create).mock.calls[0][0].data.email).toBe('maria@gmail.com')
  })
})
