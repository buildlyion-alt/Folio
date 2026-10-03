import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { DbExecutor } from '../db/client'
import { sessions, users } from '../db/schema'
import { SESSION_TTL_SECONDS } from './constants'

/*
 * Database sessions. The browser holds a random 256-bit token; the database stores only
 * its SHA-256 hash, so a leaked sessions table can't be replayed as cookies. Sessions
 * last 30 days and slide forward when used within their last 15 days.
 */

export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000
const RENEW_WITHIN_MS = 15 * 24 * 60 * 60 * 1000

export interface SessionUser {
  id: string
  email: string
  name: string
}

export interface ValidSession {
  sessionId: string
  expiresAt: Date
  user: SessionUser
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  db: DbExecutor,
  userId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ id: hashSessionToken(token), userId, expiresAt })
  return { token, expiresAt }
}

export async function validateSessionToken(
  db: DbExecutor,
  token: string
): Promise<ValidSession | null> {
  const sessionId = hashSessionToken(token)
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      name: users.name
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1)

  if (!row) return null

  const now = Date.now()
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
    return null
  }

  let expiresAt = row.expiresAt
  if (expiresAt.getTime() - now < RENEW_WITHIN_MS) {
    expiresAt = new Date(now + SESSION_TTL_MS)
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId))
  }

  return {
    sessionId,
    expiresAt,
    user: { id: row.userId, email: row.email, name: row.name }
  }
}

export async function invalidateSession(db: DbExecutor, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

export async function invalidateUserSessions(db: DbExecutor, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}
