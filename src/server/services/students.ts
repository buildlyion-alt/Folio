import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Database, DbExecutor } from '../db/client'
import { paceRecords, studentSubjects, students, subjects } from '../db/schema'
import { ProgressError, recordProgress, type ActorContext } from './progress'

export interface NewStudentInput {
  firstName: string
  lastName: string | null
  level: number | null
  enrollments: Array<{ subjectId: string; currentPace: number | null }>
}

async function assertSubjectsInHousehold(
  db: DbExecutor,
  householdId: string,
  subjectIds: string[]
): Promise<void> {
  if (subjectIds.length === 0) return
  const rows = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.householdId, householdId), inArray(subjects.id, subjectIds), isNull(subjects.archivedAt)))
  if (rows.length !== new Set(subjectIds).size) throw new ProgressError('One of those subjects isn’t available.')
}

export async function createStudent(
  db: Database,
  actor: ActorContext,
  input: NewStudentInput
): Promise<{ studentId: string }> {
  return db.transaction(async (tx) => {
    await assertSubjectsInHousehold(tx, actor.householdId, input.enrollments.map((e) => e.subjectId))

    const [{ nextOrder }] = await tx
      .select({ nextOrder: sql<number>`coalesce(max(${students.sortOrder}) + 1, 0)` })
      .from(students)
      .where(eq(students.householdId, actor.householdId))

    const [student] = await tx
      .insert(students)
      .values({
        householdId: actor.householdId,
        firstName: input.firstName,
        lastName: input.lastName,
        level: input.level,
        sortOrder: Number(nextOrder)
      })
      .returning({ id: students.id })

    for (const enrollment of input.enrollments) {
      await tx.insert(studentSubjects).values({
        householdId: actor.householdId,
        studentId: student.id,
        subjectId: enrollment.subjectId
      })
      if (enrollment.currentPace) {
        await recordProgress(tx, actor, {
          studentId: student.id,
          subjectId: enrollment.subjectId,
          paceNumber: enrollment.currentPace,
          status: 'active',
          testScore: null,
          date: null
        })
      }
    }
    return { studentId: student.id }
  })
}

export async function updateStudent(
  db: DbExecutor,
  householdId: string,
  studentId: string,
  input: { firstName: string; lastName: string | null; level: number | null }
): Promise<void> {
  const updated = await db
    .update(students)
    .set(input)
    .where(and(eq(students.id, studentId), eq(students.householdId, householdId)))
    .returning({ id: students.id })
  if (updated.length === 0) throw new ProgressError('That student isn’t in your homeschool.')
}

export async function setStudentArchived(
  db: DbExecutor,
  householdId: string,
  studentId: string,
  archived: boolean
): Promise<void> {
  const updated = await db
    .update(students)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(students.id, studentId), eq(students.householdId, householdId)))
    .returning({ id: students.id })
  if (updated.length === 0) throw new ProgressError('That student isn’t in your homeschool.')
}

/** Permanent deletion is only allowed while a student has no academic records. */
export async function deleteStudentWithoutRecords(
  db: DbExecutor,
  householdId: string,
  studentId: string
): Promise<void> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(paceRecords)
    .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
    .where(and(eq(studentSubjects.studentId, studentId), eq(paceRecords.householdId, householdId)))
  if (Number(total) > 0) {
    throw new ProgressError('This student has academic records. Archive them instead so the history is kept.')
  }
  const deleted = await db
    .delete(students)
    .where(and(eq(students.id, studentId), eq(students.householdId, householdId)))
    .returning({ id: students.id })
  if (deleted.length === 0) throw new ProgressError('That student isn’t in your homeschool.')
}

export async function enrollSubject(
  db: Database,
  actor: ActorContext,
  input: { studentId: string; subjectId: string; currentPace: number | null }
): Promise<void> {
  await db.transaction(async (tx) => {
    const [student] = await tx
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, input.studentId), eq(students.householdId, actor.householdId)))
    if (!student) throw new ProgressError('That student isn’t in your homeschool.')
    await assertSubjectsInHousehold(tx, actor.householdId, [input.subjectId])

    const [existing] = await tx
      .select({ id: studentSubjects.id, archivedAt: studentSubjects.archivedAt })
      .from(studentSubjects)
      .where(and(eq(studentSubjects.studentId, input.studentId), eq(studentSubjects.subjectId, input.subjectId)))
    if (existing && !existing.archivedAt) throw new ProgressError('Already taking this subject.')
    if (existing) {
      await tx.update(studentSubjects).set({ archivedAt: null }).where(eq(studentSubjects.id, existing.id))
    } else {
      await tx.insert(studentSubjects).values({
        householdId: actor.householdId,
        studentId: input.studentId,
        subjectId: input.subjectId
      })
    }
    if (input.currentPace) {
      await recordProgress(tx, actor, {
        studentId: input.studentId,
        subjectId: input.subjectId,
        paceNumber: input.currentPace,
        status: 'active',
        testScore: null,
        date: null
      })
    }
  })
}

/** Stops tracking a subject for a student. Records stay intact and visible in history. */
export async function unenrollSubject(
  db: DbExecutor,
  householdId: string,
  studentId: string,
  subjectId: string
): Promise<void> {
  const updated = await db
    .update(studentSubjects)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(studentSubjects.householdId, householdId),
        eq(studentSubjects.studentId, studentId),
        eq(studentSubjects.subjectId, subjectId)
      )
    )
    .returning({ id: studentSubjects.id })
  if (updated.length === 0) throw new ProgressError('That enrollment doesn’t exist.')
}
