import { NextResponse } from 'next/server'
import { getActiveCategories } from '@/lib/categories'

export async function GET() {
  const data = await getActiveCategories()
  return NextResponse.json({ ok: true, data })
}
