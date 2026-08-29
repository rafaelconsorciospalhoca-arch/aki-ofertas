import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateMerchantAccount, changeMerchantPassword } from '@/actions/account-actions'
import { requireMerchantBusiness } from '@/actions/offer-actions'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'

vi.mock('@/actions/offer-actions', () => ({ requireMerchantBusiness: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('new-hash'),
  verifyPassword: vi.fn(),
}))

const business = { id: 'biz-1', ownerId: 'user-1' }

describe('updateMerchantAccount', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await updateMerchantAccount({ name: 'Rafael', email: 'rafael@example.com' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects an invalid email', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    const result = await updateMerchantAccount({ name: 'Rafael', email: 'not-an-email' })
    expect(result).toEqual({ ok: false, error: 'E-mail inválido.' })
  })

  it('rejects an email already used by another account', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'other-user' } as never)

    const result = await updateMerchantAccount({ name: 'Rafael', email: 'taken@example.com' })

    expect(result).toEqual({ ok: false, error: 'Este e-mail já está cadastrado.' })
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'taken@example.com', NOT: { id: 'user-1' } },
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the name and email when there is no conflict', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const result = await updateMerchantAccount({ name: 'Rafael Souza', email: 'rafael@example.com' })

    expect(result).toEqual({ ok: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Rafael Souza', email: 'rafael@example.com' },
    })
  })

  it('normalizes the email to lowercase before checking for conflicts and updating', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const result = await updateMerchantAccount({ name: 'Rafael Souza', email: 'Rafael@Example.com' })

    expect(result).toEqual({ ok: true })
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'rafael@example.com', NOT: { id: 'user-1' } },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Rafael Souza', email: 'rafael@example.com' },
    })
  })
})

describe('changeMerchantPassword', () => {
  afterEach(() => vi.clearAllMocks())

  it('rejects when not authorized', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(null as never)
    const result = await changeMerchantPassword({ currentPassword: 'old12345', newPassword: 'new12345' })
    expect(result).toEqual({ ok: false, error: 'Não autorizado.' })
  })

  it('rejects a new password shorter than 8 characters', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    const result = await changeMerchantPassword({ currentPassword: 'old12345', newPassword: 'short' })
    expect(result).toEqual({ ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.' })
  })

  it('rejects when the current password is wrong', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: 'stored-hash' } as never)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const result = await changeMerchantPassword({ currentPassword: 'wrong', newPassword: 'new12345' })

    expect(result).toEqual({ ok: false, error: 'Senha atual incorreta.' })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates the password hash when the current password is correct', async () => {
    vi.mocked(requireMerchantBusiness).mockResolvedValue(business as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: 'stored-hash' } as never)
    vi.mocked(verifyPassword).mockResolvedValue(true)

    const result = await changeMerchantPassword({ currentPassword: 'old12345', newPassword: 'new12345' })

    expect(result).toEqual({ ok: true })
    expect(hashPassword).toHaveBeenCalledWith('new12345')
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: 'new-hash' } })
  })
})
