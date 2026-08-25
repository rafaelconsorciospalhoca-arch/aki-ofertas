import { NextResponse } from 'next/server'
import { getBusinessBySlug } from '@/lib/businesses'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const business = await getBusinessBySlug(params.slug)
  if (!business) {
    return NextResponse.json({ ok: false, error: 'Loja não encontrada.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, data: business })
}
