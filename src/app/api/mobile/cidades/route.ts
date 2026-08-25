import { NextResponse } from 'next/server'
import { getActiveCities } from '@/lib/categories'

export async function GET() {
  const data = await getActiveCities()
  return NextResponse.json({ ok: true, data })
}
