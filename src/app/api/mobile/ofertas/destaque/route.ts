import { NextResponse } from 'next/server'
import { getFeaturedOffers } from '@/lib/offers'
import { parseLocationParams } from '@/lib/mobile-location'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { location, city } = parseLocationParams(searchParams)

  const data = await getFeaturedOffers({ location, city, limit: 10 })
  return NextResponse.json({ ok: true, data })
}
