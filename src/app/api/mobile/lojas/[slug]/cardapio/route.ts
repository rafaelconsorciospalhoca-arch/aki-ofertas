import { NextResponse } from 'next/server'
import { getMenuItemsForBusinessSlug } from '@/lib/menu'

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const items = await getMenuItemsForBusinessSlug(params.slug)
  if (items === null) {
    return NextResponse.json({ ok: false, error: 'Loja não encontrada.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, data: items })
}
