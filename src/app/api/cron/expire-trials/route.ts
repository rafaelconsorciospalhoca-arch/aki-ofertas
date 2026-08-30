import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const expired = await prisma.business.findMany({
    where: { status: 'ACTIVE', trialEndsAt: { lt: new Date() }, category: { commissionPercent: null } },
    include: { subscriptions: { where: { status: 'ACTIVE' } } },
  })
  const toSuspend = expired.filter((b) => b.subscriptions.length === 0)

  if (toSuspend.length > 0) {
    await prisma.business.updateMany({
      where: { id: { in: toSuspend.map((b) => b.id) } },
      data: { status: 'SUSPENDED', suspendedReason: 'TRIAL_EXPIRED' },
    })
  }

  return NextResponse.json({ suspended: toSuspend.length })
}
