import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireMobileUser } from '@/lib/mobile-session'
import { getReviewsForBusinessSlug, upsertReviewForBusinessSlug } from '@/lib/reviews'

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const summary = await getReviewsForBusinessSlug(params.slug)
  if (!summary) {
    return NextResponse.json({ ok: false, error: 'Loja não encontrada.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, data: summary })
}

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
})

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireMobileUser(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  }

  const result = await upsertReviewForBusinessSlug(
    auth.userId,
    params.slug,
    parsed.data.rating,
    parsed.data.comment || null,
  )
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
