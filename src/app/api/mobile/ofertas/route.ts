import { NextResponse } from 'next/server'
import { getOffersList } from '@/lib/offers'
import { parseLocationParams } from '@/lib/mobile-location'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { location, city } = parseLocationParams(searchParams)
  const categoryId = searchParams.get('categoria') ?? undefined
  const raio = searchParams.get('raio')
  const radiusKm = raio && !Number.isNaN(Number(raio)) ? Number(raio) : undefined

  const data = await getOffersList({ categoryId, location, city, radiusKm })
  return NextResponse.json({ ok: true, data })
}
