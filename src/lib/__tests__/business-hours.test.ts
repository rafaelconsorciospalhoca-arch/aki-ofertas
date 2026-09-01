import { describe, expect, it } from 'vitest'
import { isWithinBusinessHours, type BusinessHoursRow } from '@/lib/business-hours'

// All times below are expressed as if "now" were 2026-08-31 (a Monday) at a
// given hour in America/Sao_Paulo — the helper reads the wall-clock time in
// that zone regardless of the machine's own timezone, so we build `now` from
// a UTC instant that maps to the intended São Paulo local time (UTC-3).
function saoPauloTime(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 7, 31, hour + 3, minute))
}

const monday = 1 // 2026-08-31 is a Monday; Date#getDay() convention (0=Sun..6=Sat)

describe('isWithinBusinessHours', () => {
  it('treats no configured hours at all as always open', () => {
    expect(isWithinBusinessHours([], saoPauloTime(3, 0))).toBe(true)
  })

  it('is open when now falls inside a same-day window', () => {
    const hours: BusinessHoursRow[] = [{ weekday: monday, opensAt: '11:00', closesAt: '22:00', closed: false }]
    expect(isWithinBusinessHours(hours, saoPauloTime(12, 30))).toBe(true)
  })

  it('is closed before opening time', () => {
    const hours: BusinessHoursRow[] = [{ weekday: monday, opensAt: '11:00', closesAt: '22:00', closed: false }]
    expect(isWithinBusinessHours(hours, saoPauloTime(9, 0))).toBe(false)
  })

  it('is closed at or after closing time', () => {
    const hours: BusinessHoursRow[] = [{ weekday: monday, opensAt: '11:00', closesAt: '22:00', closed: false }]
    expect(isWithinBusinessHours(hours, saoPauloTime(22, 0))).toBe(false)
  })

  it('is closed when the day is explicitly marked closed, even with times set', () => {
    const hours: BusinessHoursRow[] = [{ weekday: monday, opensAt: '11:00', closesAt: '22:00', closed: true }]
    expect(isWithinBusinessHours(hours, saoPauloTime(12, 0))).toBe(false)
  })

  it('is closed when no row exists for the current weekday', () => {
    const hours: BusinessHoursRow[] = [{ weekday: (monday + 1) % 7, opensAt: '11:00', closesAt: '22:00', closed: false }]
    expect(isWithinBusinessHours(hours, saoPauloTime(12, 0))).toBe(false)
  })

  it('is closed when a day is not marked closed but has no times set', () => {
    const hours: BusinessHoursRow[] = [{ weekday: monday, opensAt: null, closesAt: null, closed: false }]
    expect(isWithinBusinessHours(hours, saoPauloTime(12, 0))).toBe(false)
  })

  it('handles a window that crosses midnight, open side', () => {
    const hours: BusinessHoursRow[] = [{ weekday: monday, opensAt: '18:00', closesAt: '02:00', closed: false }]
    expect(isWithinBusinessHours(hours, saoPauloTime(23, 0))).toBe(true)
    expect(isWithinBusinessHours(hours, saoPauloTime(1, 30))).toBe(true)
  })

  it('handles a window that crosses midnight, closed side', () => {
    const hours: BusinessHoursRow[] = [{ weekday: monday, opensAt: '18:00', closesAt: '02:00', closed: false }]
    expect(isWithinBusinessHours(hours, saoPauloTime(10, 0))).toBe(false)
  })
})
