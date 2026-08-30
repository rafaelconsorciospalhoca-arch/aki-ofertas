import { NextResponse } from 'next/server'
import { generateWeeklyCommissionInvoices } from '@/lib/weekly-commission'

export const maxDuration = 300

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await generateWeeklyCommissionInvoices()
  return NextResponse.json(result)
}
