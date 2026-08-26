import crypto from 'node:crypto'

export const MOBILE_SESSION_DAYS = 60

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
