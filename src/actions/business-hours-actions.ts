'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireMerchantBusiness } from '@/actions/offer-actions'

const timeSchema = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Horário inválido.')

const dayRowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    closed: z.boolean(),
    opensAt: z.union([timeSchema, z.literal('')]).optional(),
    closesAt: z.union([timeSchema, z.literal('')]).optional(),
  })
  .refine((row) => row.closed || (row.opensAt && row.closesAt), {
    message: 'Informe o horário de abertura e fechamento, ou marque como fechado.',
  })

const updateHoursSchema = z.array(dayRowSchema).length(7, 'Informe os 7 dias da semana.')

export async function updateBusinessHours(
  rows: z.infer<typeof updateHoursSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await requireMerchantBusiness()
  if (!business) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = updateHoursSchema.safeParse(rows)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  await prisma.$transaction(
    parsed.data.map((row) =>
      prisma.businessHours.upsert({
        where: { businessId_weekday: { businessId: business.id, weekday: row.weekday } },
        update: {
          closed: row.closed,
          opensAt: row.closed ? null : row.opensAt || null,
          closesAt: row.closed ? null : row.closesAt || null,
        },
        create: {
          businessId: business.id,
          weekday: row.weekday,
          closed: row.closed,
          opensAt: row.closed ? null : row.opensAt || null,
          closesAt: row.closed ? null : row.closesAt || null,
        },
      }),
    ),
  )

  return { ok: true }
}
