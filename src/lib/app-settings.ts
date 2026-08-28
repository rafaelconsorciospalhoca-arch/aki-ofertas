import { prisma } from '@/lib/db'
import type { AppSettings } from '@prisma/client'

export async function getAppSettings(): Promise<AppSettings | null> {
  return prisma.appSettings.findFirst()
}

export type UpsertAppSettingsInput = {
  asaasMode: 'SANDBOX' | 'PRODUCTION'
  asaasSandboxApiKey?: string
  asaasProductionApiKey?: string
  asaasWebhookToken?: string
}

export async function upsertAppSettings(input: UpsertAppSettingsInput): Promise<void> {
  const existing = await prisma.appSettings.findFirst()
  if (existing) {
    await prisma.appSettings.update({ where: { id: existing.id }, data: input })
  } else {
    await prisma.appSettings.create({ data: input })
  }
}
