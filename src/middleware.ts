import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || 'super_secret_key_change_in_production';
const key = new TextEncoder().encode(secretKey);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl
  
  let isValidSession = false;
  
  if (token) {
    try {
      await jwtVerify(token, key);
      isValidSession = true;
    } catch (e) {
      // Invalid token
    }
  }

  // 1. If trying to access /login but already logged in -> Redirect to /
  if (pathname === '/login') {
    if (isValidSession) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // 2. If trying to access protected routes (everything else) but NOT logged in -> Redirect to /login
  if (!isValidSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
