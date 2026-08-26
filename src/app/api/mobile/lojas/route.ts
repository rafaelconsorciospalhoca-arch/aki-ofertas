import { NextResponse } from 'next/server'
import { searchBusinesses } from '@/lib/businesses'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json({ ok: true, data: [] })
  }

  const data = await searchBusinesses(query)
  return NextResponse.json({ ok: true, data })
}
