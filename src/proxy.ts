import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets
  if (/\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|json|woff2?)$/.test(pathname)) {
    return NextResponse.next()
  }

  // Public routes — no access code required
  if (
    pathname === '/' ||
    pathname === '/get' ||
    pathname === '/early-access' ||
    pathname === '/notify-confirmed' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname === '/faq' ||
    pathname === '/report-bug' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next()
  }

  // Has valid access cookie
  if (request.cookies.get('ta_access')?.value === 'true') {
    return NextResponse.next()
  }

  // Gate: redirect to pre-launch page
  return NextResponse.redirect(new URL('/', request.url))
}

