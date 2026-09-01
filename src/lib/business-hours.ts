import { prisma } from '@/lib/db'

export type BusinessHoursRow = {
  weekday: number
  opensAt: string | null
  closesAt: string | null
  closed: boolean
}

export async function getBusinessHours(businessId: string): Promise<BusinessHoursRow[]> {
  return prisma.businessHours.findMany({
    where: { businessId },
    select: { weekday: true, opensAt: true, closesAt: true, closed: true },
    orderBy: { weekday: 'asc' },
  })
}

function getSaoPauloWeekdayAndMinutes(now: Date): { weekday: number; minutesSinceMidnight: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekdayName = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)

  return { weekday: WEEKDAY_INDEX[weekdayName] ?? 0, minutesSinceMidnight: hour * 60 + minute }
}

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

// No rows configured at all means the merchant hasn't set this up yet —
// treat as always open rather than silently blocking every order, since
// this table pre-dates any UI to fill it in.
export function isWithinBusinessHours(hours: BusinessHoursRow[], now: Date = new Date()): boolean {
  if (hours.length === 0) return true

  const { weekday, minutesSinceMidnight } = getSaoPauloWeekdayAndMinutes(now)
  const today = hours.find((row) => row.weekday === weekday)
  if (!today || today.closed || !today.opensAt || !today.closesAt) return false

  const opens = toMinutes(today.opensAt)
  const closes = toMinutes(today.closesAt)
  if (opens === null || closes === null) return false

  // closesAt <= opensAt means the window crosses midnight (e.g. 18:00-02:00).
  if (closes > opens) {
    return minutesSinceMidnight >= opens && minutesSinceMidnight < closes
  }
  return minutesSinceMidnight >= opens || minutesSinceMidnight < closes
}
