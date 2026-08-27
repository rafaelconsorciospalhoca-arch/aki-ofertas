import { NextResponse } from 'next/server'
import { reverseGeocode } from '@/lib/geocode'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ ok: false, error: 'Coordenadas inválidas.' }, { status: 400 })
  }

  const result = await reverseGeocode(lat, lng)
  if (!result) {
    return NextResponse.json({ ok: false, error: 'Não foi possível identificar a cidade.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: result })
}
