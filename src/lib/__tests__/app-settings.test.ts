import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAppSettings, upsertAppSettings } from '@/lib/app-settings'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    appSettings: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

describe('getAppSettings', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns the single settings row', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({ id: 's1', asaasMode: 'SANDBOX' } as never)

    const result = await getAppSettings()

    expect(result).toEqual({ id: 's1', asaasMode: 'SANDBOX' })
  })

  it('returns null when nothing has been saved yet', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue(null)

    const result = await getAppSettings()

    expect(result).toBeNull()
  })
})

describe('upsertAppSettings', () => {
  afterEach(() => vi.clearAllMocks())

  it('creates the row when none exists', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue(null)

    await upsertAppSettings({ asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key-1' })

    expect(prisma.appSettings.create).toHaveBeenCalledWith({
      data: { asaasMode: 'SANDBOX', asaasSandboxApiKey: 'key-1' },
    })
    expect(prisma.appSettings.update).not.toHaveBeenCalled()
  })

  it('updates the existing row instead of creating a second one', async () => {
    vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({ id: 's1' } as never)

    await upsertAppSettings({ asaasMode: 'PRODUCTION', asaasProductionApiKey: 'key-2' })

    expect(prisma.appSettings.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { asaasMode: 'PRODUCTION', asaasProductionApiKey: 'key-2' },
    })
    expect(prisma.appSettings.create).not.toHaveBeenCalled()
  })
})
