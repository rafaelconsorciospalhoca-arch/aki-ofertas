'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

async function requireAdmin(): Promise<boolean> {
  const session = await auth()
  return Boolean(session?.user) && (session!.user as { role?: string }).role === 'ADMIN'
}

const businessStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED'])

export async function updateBusinessStatus(
  businessId: string,
  status: z.infer<typeof businessStatusSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = businessStatusSchema.safeParse(status)
  if (!parsed.success) {
    return { ok: false, error: 'Status inválido.' }
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    return { ok: false, error: 'Empresa não encontrada.' }
  }

  await prisma.business.update({ where: { id: businessId }, data: { status: parsed.data } })

  return { ok: true }
}
