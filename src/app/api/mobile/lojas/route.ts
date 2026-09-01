import { NextResponse } from 'next/server'
import { searchBusinesses, listBusinesses } from '@/lib/businesses'
import { parseLocationParams } from '@/lib/mobile-location'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (query) {
    const data = await searchBusinesses(query)
    return NextResponse.json({ ok: true, data })
  }

  const { city } = parseLocationParams(searchParams)
  const categoryId = searchParams.get('categoria') ?? undefined
  const data = await listBusinesses({ city, categoryId })
  return NextResponse.json({ ok: true, data })
}
