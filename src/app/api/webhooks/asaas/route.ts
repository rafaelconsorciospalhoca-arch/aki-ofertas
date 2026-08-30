import { NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/app-settings'
import { activateSubscription, suspendForPayment, markCommissionInvoicePaid, markCommissionInvoiceOverdue } from '@/lib/billing'

const ACTIVATE_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']
const SUSPEND_EVENTS = ['PAYMENT_OVERDUE', 'SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']

export async function POST(request: Request) {
  const settings = await getAppSettings()
  const token = request.headers.get('asaas-access-token')
  if (!settings?.asaasWebhookToken || token !== settings.asaasWebhookToken) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const event = body?.event as string | undefined
  const subscriptionId = (body?.payment?.subscription ?? body?.subscription?.id) as string | undefined
  const commissionInvoiceId = !subscriptionId ? (body?.payment?.externalReference as string | undefined) : undefined

  if (event && subscriptionId) {
    if (ACTIVATE_EVENTS.includes(event)) {
      await activateSubscription(subscriptionId)
    } else if (SUSPEND_EVENTS.includes(event)) {
      await suspendForPayment(subscriptionId)
    }
  } else if (event && commissionInvoiceId) {
    if (ACTIVATE_EVENTS.includes(event)) {
      await markCommissionInvoicePaid(commissionInvoiceId)
    } else if (SUSPEND_EVENTS.includes(event)) {
      await markCommissionInvoiceOverdue(commissionInvoiceId)
    }
  }

  return NextResponse.json({ ok: true })
}
