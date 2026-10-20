import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { readJSON, DB_FILES } from '@/lib/db'
import type { Config } from '@/app/actions/config'

function getSecretKey() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // ── Hotel website is fully public — let it through immediately ──
  if (pathname === '/') {
    return NextResponse.next()
  }

  // ── Friendly POS short aliases (e.g. /kitchen, /kitchen/1, /order, /billing, /pos) ──
  if (pathname === '/kitchen' || pathname === '/kitchen/') {
    return NextResponse.redirect(new URL('/management/pos/kitchen', request.url))
  }
  if (pathname.startsWith('/kitchen/')) {
    const sub = pathname.slice('/kitchen/'.length)
    return NextResponse.redirect(new URL(`/management/pos/kitchen/${sub}`, request.url))
  }
  if (pathname === '/order' || pathname === '/order/') {
    return NextResponse.redirect(new URL('/management/pos/order', request.url))
  }
  if (pathname.startsWith('/order/')) {
    const sub = pathname.slice('/order/'.length)
    return NextResponse.redirect(new URL(`/management/pos/order/${sub}`, request.url))
  }
  if (pathname === '/billing' || pathname === '/billing/') {
    return NextResponse.redirect(new URL('/management/pos/billing', request.url))
  }
  if (pathname.startsWith('/billing/')) {
    const sub = pathname.slice('/billing/'.length)
    return NextResponse.redirect(new URL(`/management/pos/billing/${sub}`, request.url))
  }
  if (pathname === '/pos' || pathname === '/pos/') {
    return NextResponse.redirect(new URL('/management/pos', request.url))
  }
  if (pathname.startsWith('/pos/')) {
    const sub = pathname.slice('/pos/'.length)
    return NextResponse.redirect(new URL(`/management/pos/${sub}`, request.url))
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

  // Already logged in → hitting login page → redirect to dashboard or designated POS home
  if (pathname === '/management/login') {
    if (isValidSession) {
      try {
        const { payload } = await jwtVerify(token!, getSecretKey())
        if (payload.posRole === true && typeof payload.role === 'string') {
          const ROLE_HOME: Record<string, string> = {
            billing: '/management/pos/billing',
            kitchen: '/management/pos/kitchen',
            waiter:  '/management/pos/order',
          }
          const home = ROLE_HOME[payload.role]
          if (home) {
            return NextResponse.redirect(new URL(home, request.url))
          }
        }
      } catch {
        // Fallback to /management
      }
      return NextResponse.redirect(new URL('/management', request.url))
    }
    return NextResponse.next()
  }

  // Not logged in → hitting any other /management/* route → redirect to login
  if (!isValidSession) {
    return NextResponse.redirect(new URL('/management/login', request.url))
  }

  // ── POS module enabled check ────────────────────────────────────
  // Intercept direct access to /management/pos/* when POS is toggled off (Req 9.2)
  if (pathname.startsWith('/management/pos')) {
    try {
      const configList = await readJSON<Config>(DB_FILES.CONFIG)
      const isPosEnabled = configList.length > 0 && configList[0]?.pos === true
      if (!isPosEnabled) {
        return NextResponse.redirect(new URL('/management', request.url))
      }
    } catch {
      // Default fail-open to page guard if datastore read errors
    }
  }

  // ── POS-dedicated role redirect enforcement ─────────────────────
  // billing/kitchen/waiter accounts can only access their designated page
  try {
    const { payload } = await jwtVerify(token!, getSecretKey())
    if (payload.posRole === true && typeof payload.role === 'string') {
      const ROLE_HOME: Record<string, string> = {
        billing: '/management/pos/billing',
        kitchen: '/management/pos/kitchen',
        waiter:  '/management/pos/order',
      }
      const home = ROLE_HOME[payload.role]
      if (home && !pathname.startsWith(home) && pathname !== '/management/login') {
        return NextResponse.redirect(new URL(home, request.url))
      }
    }
  } catch {
    // Token already verified above; ignore edge-case re-verify failures
  }

  // Logged in → add no-cache headers to prevent browser caching management pages
  // Also pass x-pathname in request headers so layouts know the current path
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
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
