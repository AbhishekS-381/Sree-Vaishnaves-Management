import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

function getSecretKey() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // ── Hotel website is fully public — let it through immediately ──
  if (pathname === '/') {
    return NextResponse.next()
  }

  // ── Only intercept /management/* routes ─────────────────────────
  // Everything else (static assets, API routes) passes through
  if (!pathname.startsWith('/management')) {
    return NextResponse.next()
  }

  // ── Verify session for all /management/* routes ─────────────────
  let isValidSession = false

  if (token) {
    try {
      await jwtVerify(token, getSecretKey())
      isValidSession = true
    } catch {
      // Invalid or expired token — treat as logged out
    }
  }

  // Already logged in → hitting login page → redirect to dashboard
  if (pathname === '/management/login') {
    if (isValidSession) {
      return NextResponse.redirect(new URL('/management', request.url))
    }
    return NextResponse.next()
  }

  // Not logged in → hitting any other /management/* route → redirect to login
  if (!isValidSession) {
    return NextResponse.redirect(new URL('/management/login', request.url))
  }

  // Logged in → add no-cache headers to prevent browser caching management pages
  const response = NextResponse.next()
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  )
  response.headers.set('Pragma', 'no-cache')
  return response
}

export const config = {
  // Match / and /management/* but exclude Next.js internals and all public static files
  // The exclusion of assets|images|main.css prevents middleware running on hotel CSS/JS files
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|assets|images|main\\.css).*)',
  ],
}
