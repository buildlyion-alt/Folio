import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './server/auth/constants'

/*
 * Optimistic route protection. Proxy only checks that a session cookie exists — the
 * database check happens in the data access layer (requireSession / requireHousehold)
 * on every page and action, so a forged or stale cookie still gets nowhere.
 */

const PUBLIC_PATHS = ['/sign-in', '/sign-up']

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE)?.value
  // The root is the public landing page; it matches exactly so it can't open up the app.
  const isPublic = pathname === '/' || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!token && !isPublic) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(signIn)
  }

  const response = NextResponse.next()
  // Slide the cookie forward on page loads so active families stay signed in;
  // the session row's expiry in the database remains the authority.
  if (token && request.method === 'GET') {
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS
    })
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico|webmanifest|woff2?)$).*)']
}
