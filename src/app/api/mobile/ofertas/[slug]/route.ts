import { NextResponse } from 'next/server'
import { getOfferBySlug } from '@/lib/offers'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const offer = await getOfferBySlug(params.slug)
  if (!offer) {
    return NextResponse.json({ ok: false, error: 'Oferta não encontrada.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, data: offer })
}
