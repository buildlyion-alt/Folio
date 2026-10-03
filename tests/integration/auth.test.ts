import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { createSession, hashSessionToken, invalidateSession, invalidateUserSessions, validateSessionToken } from '@/server/auth/session'
import { sessions, users } from '@/server/db/schema'
import { changePassword } from '@/server/services/settings'
import { openTestDatabase } from './helpers'

const { db, pool } = openTestDatabase()
let userId: string

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({ name: 'Auth Test', email: `auth-${randomUUID()}@example.test`, passwordHash: await hashPassword('correct-horse-9') })
    .returning({ id: users.id })
  userId = user.id
})

afterAll(async () => {
  await db.delete(users).where(eq(users.id, userId))
  await pool.end()
})

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    expect(user.passwordHash).not.toContain('correct-horse-9')
    expect(await verifyPassword('correct-horse-9', user.passwordHash)).toBe(true)
    expect(await verifyPassword('correct-horse-8', user.passwordHash)).toBe(false)
  })
})

describe('sessions', () => {
  it('stores only a hash of the token and resolves it back to the user', async () => {
    const { token } = await createSession(db, userId)
    const [row] = await db.select().from(sessions).where(eq(sessions.id, hashSessionToken(token)))
    expect(row.id).not.toBe(token)
    expect(await validateSessionToken(db, token)).toMatchObject({ user: { id: userId } })
    expect(await validateSessionToken(db, `${token}x`)).toBeNull()
  })

  it('ends a session on sign-out', async () => {
    const { token } = await createSession(db, userId)
    await invalidateSession(db, hashSessionToken(token))
    expect(await validateSessionToken(db, token)).toBeNull()
  })

  it('rejects and removes expired sessions', async () => {
    const { token } = await createSession(db, userId)
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, hashSessionToken(token)))
    expect(await validateSessionToken(db, token)).toBeNull()
    expect(await db.select().from(sessions).where(eq(sessions.id, hashSessionToken(token)))).toHaveLength(0)
  })

  it('slides the expiry forward when a session is used in its second half', async () => {
    const { token } = await createSession(db, userId)
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    await db.update(sessions).set({ expiresAt: soon }).where(eq(sessions.id, hashSessionToken(token)))
    const session = await validateSessionToken(db, token)
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })

  it('signs out every other device after a password change, keeping the current one', async () => {
    const current = await createSession(db, userId)
    const elsewhere = await createSession(db, userId)
    await expect(changePassword(db, userId, 'wrong-password', 'battery-staple-1', hashSessionToken(current.token))).rejects.toThrow(
      'Your current password is incorrect.'
    )
    expect(await validateSessionToken(db, elsewhere.token)).not.toBeNull()

    await changePassword(db, userId, 'correct-horse-9', 'battery-staple-1', hashSessionToken(current.token))
    expect(await validateSessionToken(db, current.token)).not.toBeNull()
    expect(await validateSessionToken(db, elsewhere.token)).toBeNull()
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    expect(await verifyPassword('battery-staple-1', user.passwordHash)).toBe(true)
  })

  it('can end every session for a user', async () => {
    const a = await createSession(db, userId)
    const b = await createSession(db, userId)
    await invalidateUserSessions(db, userId)
    expect(await validateSessionToken(db, a.token)).toBeNull()
    expect(await validateSessionToken(db, b.token)).toBeNull()
  })
})
