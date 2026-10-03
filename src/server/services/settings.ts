import { and, eq, ne, sql } from 'drizzle-orm'
import type { DbExecutor } from '../db/client'
import { academicTerms, households, sessions, subjects, users } from '../db/schema'
import { hashPassword, verifyPassword } from '../auth/password'
import { ProgressError } from './progress'

export async function updateHouseholdSettings(
  db: DbExecutor,
  householdId: string,
  input: {
    name: string
    timezone: string
    passMark: number
    pacesPerYear: number
    schoolYearStart: string | null
  }
): Promise<void> {
  await db.update(households).set(input).where(eq(households.id, householdId))
}

async function assertUniqueSubjectName(
  db: DbExecutor,
  householdId: string,
  name: string,
  exceptId?: string
): Promise<void> {
  const conditions = [eq(subjects.householdId, householdId), sql`lower(${subjects.name}) = lower(${name})`]
  if (exceptId) conditions.push(ne(subjects.id, exceptId))
  const [clash] = await db.select({ id: subjects.id, archivedAt: subjects.archivedAt }).from(subjects).where(and(...conditions))
  if (clash) {
    throw new ProgressError(
      clash.archivedAt ? `“${name}” exists but is archived — restore it instead.` : `You already have a subject called “${name}”.`,
      'name'
    )
  }
}

export async function createSubject(db: DbExecutor, householdId: string, name: string): Promise<string> {
  await assertUniqueSubjectName(db, householdId, name)
  const [{ nextOrder }] = await db
    .select({ nextOrder: sql<number>`coalesce(max(${subjects.sortOrder}) + 1, 0)` })
    .from(subjects)
    .where(eq(subjects.householdId, householdId))
  const [row] = await db
    .insert(subjects)
    .values({ householdId, name, sortOrder: Number(nextOrder) })
    .returning({ id: subjects.id })
  return row.id
}

export async function renameSubject(db: DbExecutor, householdId: string, subjectId: string, name: string): Promise<void> {
  await assertUniqueSubjectName(db, householdId, name, subjectId)
  const updated = await db
    .update(subjects)
    .set({ name })
    .where(and(eq(subjects.id, subjectId), eq(subjects.householdId, householdId)))
    .returning({ id: subjects.id })
  if (updated.length === 0) throw new ProgressError('That subject doesn’t exist.')
}

export async function setSubjectArchived(
  db: DbExecutor,
  householdId: string,
  subjectId: string,
  archived: boolean
): Promise<void> {
  const updated = await db
    .update(subjects)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(subjects.id, subjectId), eq(subjects.householdId, householdId)))
    .returning({ id: subjects.id })
  if (updated.length === 0) throw new ProgressError('That subject doesn’t exist.')
}

export async function createTerm(
  db: DbExecutor,
  householdId: string,
  input: { name: string; startsOn: string; endsOn: string }
): Promise<void> {
  await db.insert(academicTerms).values({ householdId, ...input })
}

export async function updateTerm(
  db: DbExecutor,
  householdId: string,
  termId: string,
  input: { name: string; startsOn: string; endsOn: string }
): Promise<void> {
  const updated = await db
    .update(academicTerms)
    .set(input)
    .where(and(eq(academicTerms.id, termId), eq(academicTerms.householdId, householdId)))
    .returning({ id: academicTerms.id })
  if (updated.length === 0) throw new ProgressError('That term doesn’t exist.')
}

export async function deleteTerm(db: DbExecutor, householdId: string, termId: string): Promise<void> {
  await db.delete(academicTerms).where(and(eq(academicTerms.id, termId), eq(academicTerms.householdId, householdId)))
}

export async function updateAccount(
  db: DbExecutor,
  userId: string,
  input: { name: string; email: string }
): Promise<void> {
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = lower(${input.email})`, ne(users.id, userId)))
  if (clash) throw new ProgressError('Another account already uses that email.', 'email')
  await db.update(users).set(input).where(eq(users.id, userId))
}

/** Changes the password and signs out every other session, keeping the one making the change. */
export async function changePassword(
  db: DbExecutor,
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId: string
): Promise<void> {
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId))
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ProgressError('Your current password is incorrect.', 'currentPassword')
  }
  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId))
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)))
}
