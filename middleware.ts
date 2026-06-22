import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_EXACT = new Set([
  '/', '/get', '/early-access', '/notify-confirmed',
  '/terms', '/privacy', '/faq', '/report-bug',
])
const PUBLIC_PREFIX = ['/auth', '/api', '/_next']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets — always allow
  if (/\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|json|woff2?)$/.test(pathname)) {
    return NextResponse.next()
  }

  // Public pages — always allow
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Gate: need the access cookie (set when code 0371 is entered)
  if (request.cookies.get('ta_access')?.value === 'true') {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
