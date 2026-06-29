export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ photos: [] })

  const key = process.env.PEXELS_API_KEY
  if (!key) {
    console.error('[photos] PEXELS_API_KEY not set')
    return NextResponse.json({ photos: [], error: 'no_key' }, { status: 500 })
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q + ' travel')}&per_page=12&orientation=landscape`

  const res = await fetch(url, {
    headers: { Authorization: key },
    next: { revalidate: 60 * 60 * 24 }, // cache 24h per query
  })

  if (!res.ok) return NextResponse.json({ photos: [] })

  const data = await res.json()
  const photos: string[] = (data.photos ?? []).map((p: any) => p.src.large2x || p.src.large)

  return NextResponse.json({ photos })
}
