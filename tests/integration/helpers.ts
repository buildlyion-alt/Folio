import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { onboardingSchema } from '@/domain/validation'
import { createDatabase, type Database } from '@/server/db/client'
import { households, studentSubjects, students, subjects, users } from '@/server/db/schema'
import { completeOnboarding } from '@/server/services/onboarding'
import type { ActorContext } from '@/server/services/progress'

/*
 * Integration tests run against a real Postgres database (folio_test by default) with the
 * migrations applied. Each test file creates its own households and deletes them after,
 * so nothing depends on, or disturbs, other data in the database.
 */

const url = process.env.TEST_DATABASE_URL ?? 'postgres://folio:folio@127.0.0.1:5432/folio_test'
const databaseName = new URL(url).pathname.slice(1)
if (!databaseName.endsWith('_test')) {
  throw new Error(`Refusing to run integration tests against “${databaseName}” — use a database whose name ends in _test.`)
}

export const TODAY = '2026-10-02'
/** Mid-afternoon in America/Chicago on TODAY. */
export const NOW = new Date('2026-10-02T20:00:00Z')

export function openTestDatabase() {
  return createDatabase(url)
}

export interface TestHousehold {
  userId: string
  householdId: string
  student: { gabriel: string; sarah: string }
  subject: { math: string; english: string; science: string }
  actor: (source?: ActorContext['source']) => ActorContext
}

/** A small onboarded homeschool: Gabriel (Math 1084, English 1081), Sarah (Math 1072, English 1078). Science has no one enrolled. */
export async function createTestHousehold(db: Database, label: string): Promise<TestHousehold> {
  const [user] = await db
    .insert(users)
    .values({ name: `${label} Parent`, email: `${label}-${randomUUID()}@example.test`, passwordHash: 'not-a-real-hash' })
    .returning({ id: users.id })

  const data = onboardingSchema.parse({
    householdName: `${label} Homeschool`,
    timezone: 'America/Chicago',
    students: [
      { key: 'g', firstName: 'Gabriel', lastName: 'Carter', level: 7 },
      { key: 's', firstName: 'Sarah', lastName: 'Carter', level: 6 }
    ],
    subjects: [
      { key: 'math', name: 'Mathematics' },
      { key: 'eng', name: 'English' },
      { key: 'sci', name: 'Science' }
    ],
    positions: [
      { studentKey: 'g', subjectKey: 'math', paceNumber: 1084 },
      { studentKey: 'g', subjectKey: 'eng', paceNumber: 1081 },
      { studentKey: 's', subjectKey: 'math', paceNumber: 1072 },
      { studentKey: 's', subjectKey: 'eng', paceNumber: 1078 }
    ]
  })
  const { householdId } = await completeOnboarding(db, user.id, data, TODAY)

  const studentRows = await db.select().from(students).where(eq(students.householdId, householdId))
  const subjectRows = await db.select().from(subjects).where(eq(subjects.householdId, householdId))
  const studentId = (name: string) => studentRows.find((s) => s.firstName === name)!.id
  const subjectId = (name: string) => subjectRows.find((s) => s.name === name)!.id

  return {
    userId: user.id,
    householdId,
    student: { gabriel: studentId('Gabriel'), sarah: studentId('Sarah') },
    subject: { math: subjectId('Mathematics'), english: subjectId('English'), science: subjectId('Science') },
    actor: (source = 'manual') => ({ householdId, actorUserId: user.id, source, today: TODAY })
  }
}

export async function enrollmentId(db: Database, householdId: string, studentId: string, subjectId: string): Promise<string> {
  const [row] = await db
    .select({ id: studentSubjects.id })
    .from(studentSubjects)
    .where(
      and(eq(studentSubjects.householdId, householdId), eq(studentSubjects.studentId, studentId), eq(studentSubjects.subjectId, subjectId))
    )
  return row.id
}

export async function removeTestHouseholds(db: Database, created: TestHousehold[]): Promise<void> {
  if (created.length === 0) return
  await db.delete(households).where(inArray(households.id, created.map((h) => h.householdId)))
  await db.delete(users).where(inArray(users.id, created.map((h) => h.userId)))
}
