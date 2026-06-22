import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_EXACT = new Set(['/', '/get', '/early-access', '/notify-confirmed', '/terms', '/privacy', '/faq', '/report-bug'])
const PUBLIC_PREFIX = ['/auth', '/api', '/_next']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (/\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|json|woff2?)$/.test(pathname)) return NextResponse.next()
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (request.cookies.get('ta_access')?.value === 'true') return NextResponse.next()

  return NextResponse.redirect(new URL('/', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
