import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './constants'

export { SESSION_COOKIE }

export function sessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds
  }
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, sessionCookieOptions())
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { ...sessionCookieOptions(0), maxAge: 0 })
}
