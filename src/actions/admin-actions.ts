'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { upsertAppSettings, type UpsertAppSettingsInput } from '@/lib/app-settings'

async function requireAdmin(): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) {
    return false
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  return Boolean(user) && user!.role === 'ADMIN' && !user!.blocked
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

  const isApprovingFromPending = business.status === 'PENDING' && parsed.data === 'ACTIVE'
  const suspendedReasonUpdate =
    parsed.data === 'SUSPENDED' ? { suspendedReason: 'ADMIN' as const } : parsed.data === 'ACTIVE' ? { suspendedReason: null } : {}

  await prisma.business.update({
    where: { id: businessId },
    data: isApprovingFromPending
      ? { status: parsed.data, trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), ...suspendedReasonUpdate }
      : { status: parsed.data, ...suspendedReasonUpdate },
  })

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

export async function toggleUserBlocked(
  userId: string,
  blocked: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const session = await auth()
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) {
    return { ok: false, error: 'Usuário não encontrado.' }
  }

  if (blocked && target.id === session?.user?.id) {
    return { ok: false, error: 'Você não pode bloquear sua própria conta.' }
  }

  await prisma.user.update({ where: { id: userId }, data: { blocked } })

  return { ok: true }
}

const userProfileSchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  email: z.string().email('E-mail inválido.'),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})

type UserProfileInput = z.infer<typeof userProfileSchema>

export async function updateUser(
  userId: string,
  input: UserProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = userProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) {
    return { ok: false, error: 'Usuário não encontrado.' }
  }

  // User.email is a case-sensitive unique column; normalizing keeps a single
  // account per address across this form and the passwordless mobile flows.
  const email = parsed.data.email.trim().toLowerCase()

  const conflict = await prisma.user.findFirst({
    where: { email, NOT: { id: userId } },
  })
  if (conflict) {
    return { ok: false, error: 'Este e-mail já está cadastrado.' }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
    },
  })

  return { ok: true }
}

const planSchema = z.object({
  name: z.string().min(2, 'Informe o nome do plano.'),
  priceReais: z.string().min(1, 'Informe o preço.'),
  maxOffersPerMonth: z.string().min(1, 'Informe o limite de ofertas.'),
  hasFlashOffers: z.boolean(),
  hasFullMetrics: z.boolean(),
})

type PlanInput = z.infer<typeof planSchema>
type PlanResult = { ok: true; planId: string } | { ok: false; error: string }

function parsePlanData(input: PlanInput): { priceCents: number; maxOffersPerMonth: number } | { error: string } {
  const priceCents = Math.round(Number(input.priceReais) * 100)
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return { error: 'Preço inválido.' }
  }
  const maxOffersPerMonth = Number(input.maxOffersPerMonth)
  if (!Number.isInteger(maxOffersPerMonth) || maxOffersPerMonth < 0) {
    return { error: 'Limite de ofertas inválido.' }
  }
  return { priceCents, maxOffersPerMonth }
}

export async function createPlan(input: PlanInput): Promise<PlanResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = planSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const data = parsePlanData(parsed.data)
  if ('error' in data) {
    return { ok: false, error: data.error }
  }

  const existing = await prisma.plan.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return { ok: false, error: 'Este plano já existe.' }
  }

  const plan = await prisma.plan.create({
    data: {
      name: parsed.data.name,
      priceCents: data.priceCents,
      maxOffersPerMonth: data.maxOffersPerMonth,
      hasFlashOffers: parsed.data.hasFlashOffers,
      hasFullMetrics: parsed.data.hasFullMetrics,
    },
  })

  return { ok: true, planId: plan.id }
}

export async function saveAppSettings(input: UpsertAppSettingsInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  await upsertAppSettings(input)
  return { ok: true }
}

export async function updatePlan(id: string, input: PlanInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: 'Não autorizado.' }
  }

  const parsed = planSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const data = parsePlanData(parsed.data)
  if ('error' in data) {
    return { ok: false, error: data.error }
  }

  const existing = await prisma.plan.findUnique({ where: { id } })
  if (!existing) {
    return { ok: false, error: 'Plano não encontrado.' }
  }

  await prisma.plan.update({
    where: { id },
    data: {
      name: parsed.data.name,
      priceCents: data.priceCents,
      maxOffersPerMonth: data.maxOffersPerMonth,
      hasFlashOffers: parsed.data.hasFlashOffers,
      hasFullMetrics: parsed.data.hasFullMetrics,
    },
  })

  return { ok: true }
}
