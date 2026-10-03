'use server'

import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { fieldErrors, signInSchema, signUpSchema } from '@/domain/validation'
import { getDb } from '@/server/db'
import { users } from '@/server/db/schema'
import { clearSessionCookie, setSessionCookie } from '@/server/auth/cookies'
import { getSession } from '@/server/auth/context'
import { getDecoyHash, hashPassword, verifyPassword } from '@/server/auth/password'
import { consumeAttempt, resetAttempts } from '@/server/auth/rate-limit'
import { createSession, invalidateSession } from '@/server/auth/session'

export interface AuthFormState {
  errors?: Record<string, string>
  values?: { name?: string; email?: string }
}

/** Only allow redirects back into the app (blocks open-redirects like //evil.com). */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/home'
  return value
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? '')
  }
  const values = { name: raw.name, email: raw.email }
  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values }

  const db = getDb()
  const { name, email, password } = parsed.data
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1)
  if (existing) {
    return { errors: { email: 'An account with this email already exists. Try signing in.' }, values }
  }

  let userId: string
  try {
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash: await hashPassword(password) })
      .returning({ id: users.id })
    userId = user.id
  } catch {
    // Unique index race: someone registered the same email a moment ago.
    return { errors: { email: 'An account with this email already exists. Try signing in.' }, values }
  }

  const { token } = await createSession(db, userId)
  await setSessionCookie(token)
  redirect('/onboarding')
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: String(formData.get('email') ?? ''), password: String(formData.get('password') ?? '') }
  const values = { email: raw.email }
  const parsed = signInSchema.safeParse(raw)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values }

  const { email, password } = parsed.data
  const limit = consumeAttempt(`sign-in:${email}`, 8, 15 * 60 * 1000)
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterMs / 60_000)
    return { errors: { _form: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` }, values }
  }

  const db = getDb()
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1)

  // Verify against a decoy hash when the email is unknown, so both paths cost the same.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDecoyHash()))
  if (!user || !valid) {
    return { errors: { _form: 'That email and password don’t match an account.' }, values }
  }

  resetAttempts(`sign-in:${email}`)
  const { token } = await createSession(db, user.id)
  await setSessionCookie(token)
  redirect(safeNext(formData.get('next')))
}

export async function signOut(): Promise<void> {
  const session = await getSession()
  if (session) await invalidateSession(getDb(), session.sessionId)
  await clearSessionCookie()
  redirect('/sign-in')
}
