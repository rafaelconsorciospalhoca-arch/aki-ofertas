import { getAppSettings } from '@/lib/app-settings'

const BASE_URL = {
  SANDBOX: 'https://api-sandbox.asaas.com/v3',
  PRODUCTION: 'https://api.asaas.com/v3',
} as const

async function asaasFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const settings = await getAppSettings()
  if (!settings) throw new Error('Asaas não configurado.')

  const mode = settings.asaasMode as 'SANDBOX' | 'PRODUCTION'
  const apiKey = mode === 'PRODUCTION' ? settings.asaasProductionApiKey : settings.asaasSandboxApiKey
  if (!apiKey) throw new Error('Chave de API do Asaas não configurada para o modo atual.')

  const res = await fetch(`${BASE_URL[mode]}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', access_token: apiKey, ...init.headers },
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(`Asaas ${path} falhou: ${JSON.stringify(body)}`)
  }
  return body
}

export type CreateAsaasCustomerInput = {
  name: string
  cpfCnpj: string
  email: string
  mobilePhone: string
  externalReference: string
}

export async function createAsaasCustomer(input: CreateAsaasCustomerInput): Promise<string> {
  const body = await asaasFetch('/customers', { method: 'POST', body: JSON.stringify(input) })
  return body.id as string
}

export type CreateAsaasSubscriptionInput = {
  customerId: string
  value: number
  description: string
  externalReference: string
}

export type CreateAsaasSubscriptionResult = { subscriptionId: string; invoiceUrl: string }

export async function createAsaasSubscription(
  input: CreateAsaasSubscriptionInput,
): Promise<CreateAsaasSubscriptionResult> {
  const subscription = await asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: 'UNDEFINED',
      value: input.value,
      cycle: 'MONTHLY',
      nextDueDate: new Date().toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.externalReference,
      callback: {
        successUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://akiofertas.com.br'}/comerciante/plano?pago=1`,
      },
    }),
  })

  const payments = (await asaasFetch(`/subscriptions/${subscription.id}/payments`, { method: 'GET' })) as {
    data: { invoiceUrl: string }[]
  }
  const invoiceUrl = payments.data[0]?.invoiceUrl
  if (!invoiceUrl) {
    throw new Error('Assinatura criada, mas sem link de pagamento.')
  }

  return { subscriptionId: subscription.id as string, invoiceUrl }
}
