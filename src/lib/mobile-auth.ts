import crypto from 'node:crypto'
import { hashPassword, verifyPassword } from '@/lib/password'

export const OTP_EXPIRY_MINUTES = 5
export const MAX_OTP_ATTEMPTS = 5
export const MOBILE_SESSION_DAYS = 60

export function generateOtpCode(): string {
  // crypto.randomInt, not Math.random: V8's PRNG state is reconstructable from
  // observed outputs, which would make a security code guessable.
  return String(crypto.randomInt(100000, 1000000))
}

export async function hashOtpCode(code: string): Promise<string> {
  return hashPassword(code)
}

export async function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return verifyPassword(code, hash)
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}
