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

const categorySchema = z.object({
  name: z.string().min(2, 'Informe o nome da categoria.'),
  icon: z.string().min(1, 'Informe o ícone.'),
  order: z.string().min(1, 'Informe a ordem.'),
  active: z.boolean(),
})

type CategoryInput = z.infer<typeof categorySchema>
type CategoryResult = { ok: true; categoryId: string } | { ok: false; error: string }

function parseOrder(value: string): number | { error: string } {
  const order = Number(value)
  if (!Number.isInteger(order) || order < 0) {
    return { error: 'Ordem inválida.' }
  }
  return order
}

export async function createCategory(input: CategoryInput): Promise<CategoryResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const order = parseOrder(parsed.data.order)
  if (typeof order !== 'number') {
    return { ok: false, error: order.error }
  }

  const existing = await prisma.category.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return { ok: false, error: 'Esta categoria já existe.' }
  }

  const category = await prisma.category.create({
    data: { name: parsed.data.name, icon: parsed.data.icon, order, active: parsed.data.active },
  })

  return { ok: true, categoryId: category.id }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const order = parseOrder(parsed.data.order)
  if (typeof order !== 'number') {
    return { ok: false, error: order.error }
  }

  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) {
    return { ok: false, error: 'Categoria não encontrada.' }
  }

  await prisma.category.update({
    where: { id },
    data: { name: parsed.data.name, icon: parsed.data.icon, order, active: parsed.data.active },
  })

  return { ok: true }
}

const citySchema = z.object({
  name: z.string().min(2, 'Informe o nome da cidade.'),
  state: z.string().length(2, 'Use a sigla do estado (ex: PR).'),
  active: z.boolean(),
  comingSoon: z.boolean(),
})

type CityInput = z.infer<typeof citySchema>
type CityResult = { ok: true; cityId: string } | { ok: false; error: string }

export async function createCity(input: CityInput): Promise<CityResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = citySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const state = parsed.data.state.toUpperCase()

  const existing = await prisma.city.findFirst({ where: { name: parsed.data.name, state } })
  if (existing) {
    return { ok: false, error: 'Esta cidade já existe.' }
  }

  const city = await prisma.city.create({
    data: { name: parsed.data.name, state, active: parsed.data.active, comingSoon: parsed.data.comingSoon },
  })

  return { ok: true, cityId: city.id }
}

export async function updateCity(
  id: string,
  input: CityInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = citySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.city.findUnique({ where: { id } })
  if (!existing) {
    return { ok: false, error: 'Cidade não encontrada.' }
  }

  await prisma.city.update({
    where: { id },
    data: {
      name: parsed.data.name,
      state: parsed.data.state.toUpperCase(),
      active: parsed.data.active,
      comingSoon: parsed.data.comingSoon,
    },
  })

  return { ok: true }
}
