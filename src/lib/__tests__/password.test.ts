import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password hashing', () => {
  it('hashes a password to a different string', async () => {
    const hash = await hashPassword('supersecret123')
    expect(hash).not.toBe('supersecret123')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('supersecret123')
    await expect(verifyPassword('supersecret123', hash)).resolves.toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('supersecret123')
    await expect(verifyPassword('wrongpassword', hash)).resolves.toBe(false)
  })
})
