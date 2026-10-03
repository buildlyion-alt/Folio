import { and, eq, ne } from 'drizzle-orm'
import { formatShortDate, type IsoDate } from '@/domain/dates'
import type { PaceStatus } from '@/domain/pace'
import type { DbExecutor } from '../db/client'
import {
  paceRecords,
  progressEvents,
  studentSubjects,
  students,
  subjects,
  type PaceRecord,
  type PaceSnapshot,
  type ProgressEventKind,
  type ProgressSource
} from '../db/schema'

/*
 * The single write path for academic progress.
 *
 * The Log Progress form, the assistant (after confirmation), onboarding and record edits
 * all end up here, so one entry always updates the same canonical pace_record and appends
 * one audit event — dashboards, profiles, records and reports all read from those two
 * tables, which is what makes "one record propagates everywhere" true by construction.
 */

export class ProgressError extends Error {
  constructor(
    message: string,
    readonly field?: string
  ) {
    super(message)
    this.name = 'ProgressError'
  }
}

export interface ActorContext {
  householdId: string
  actorUserId: string | null
  source: ProgressSource
  /** The household's local date, used to reject future-dated entries. */
  today: IsoDate
}

export interface RecordProgressInput {
  studentId: string
  subjectId: string
  paceNumber: number
  status: PaceStatus
  testScore: number | null
  /** Completion date (completed) or start date (active). Null start date = unknown. */
  date: IsoDate | null
  /** undefined leaves existing notes untouched. */
  notes?: string | null
}

export interface RecordProgressResult {
  record: PaceRecord
  previous: PaceSnapshot | null
  eventKind: ProgressEventKind | null
  enrollmentId: string
  studentName: string
  subjectName: string
  /** Set when a PACE was completed and the next one could be started. */
  nextPace: number | null
}

export function snapshotOf(record: PaceRecord): PaceSnapshot {
  return {
    status: record.status,
    startedOn: record.startedOn,
    completedOn: record.completedOn,
    testScore: record.testScore,
    notes: record.notes
  }
}

export interface Enrollment {
  enrollmentId: string
  studentName: string
  subjectName: string
}

/** Finds the active enrollment, scoped to the household. Throws if it doesn't exist. */
export async function findEnrollment(
  db: DbExecutor,
  householdId: string,
  studentId: string,
  subjectId: string
): Promise<Enrollment> {
  const [row] = await db
    .select({
      enrollmentId: studentSubjects.id,
      firstName: students.firstName,
      subjectName: subjects.name,
      enrollmentArchived: studentSubjects.archivedAt,
      studentArchived: students.archivedAt
    })
    .from(studentSubjects)
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(
      and(
        eq(studentSubjects.householdId, householdId),
        eq(studentSubjects.studentId, studentId),
        eq(studentSubjects.subjectId, subjectId)
      )
    )
    .limit(1)

  if (!row || row.enrollmentArchived || row.studentArchived) {
    const [student] = await db
      .select({ firstName: students.firstName })
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.householdId, householdId)))
    if (!student) throw new ProgressError('That student isn’t in your homeschool.', 'studentId')
    throw new ProgressError(`${student.firstName} isn’t taking that subject.`, 'subjectId')
  }
  return { enrollmentId: row.enrollmentId, studentName: row.firstName, subjectName: row.subjectName }
}

function assertNotFuture(date: IsoDate | null, today: IsoDate, field = 'date'): void {
  if (date && date > today) throw new ProgressError('Dates can’t be in the future.', field)
}

function eventKindFor(previous: PaceSnapshot | null, next: PaceSnapshot): ProgressEventKind | null {
  if (!previous) {
    if (next.status === 'completed') return 'completed'
    if (next.status === 'active') return 'started'
    return 'updated'
  }
  if (previous.status !== next.status) {
    if (next.status === 'completed') return 'completed'
    if (next.status === 'not_started') return 'reset'
    return previous.status === 'completed' ? 'reopened' : 'started'
  }
  const changed =
    previous.startedOn !== next.startedOn ||
    previous.completedOn !== next.completedOn ||
    previous.testScore !== next.testScore ||
    previous.notes !== next.notes
  return changed ? 'updated' : null
}

/** Resolves the next state of a record from an entry, enforcing A.C.E. record rules. */
function nextStateFor(
  existing: PaceRecord | undefined,
  input: RecordProgressInput,
  today: IsoDate
): PaceSnapshot {
  const notes = input.notes === undefined ? (existing?.notes ?? null) : input.notes

  switch (input.status) {
    case 'completed': {
      const completedOn = input.date ?? today
      assertNotFuture(completedOn, today)
      const startedOn = existing?.startedOn ?? null
      if (startedOn && completedOn < startedOn) {
        throw new ProgressError(
          `This PACE was started on ${formatShortDate(startedOn)}, so it can’t be completed before then.`,
          'date'
        )
      }
      return { status: 'completed', startedOn, completedOn, testScore: input.testScore, notes }
    }
    case 'active': {
      assertNotFuture(input.date, today)
      const startedOn = input.date ?? existing?.startedOn ?? null
      return { status: 'active', startedOn, completedOn: null, testScore: null, notes }
    }
    case 'not_started':
      return { status: 'not_started', startedOn: null, completedOn: null, testScore: null, notes }
  }
}

async function suggestNextPace(
  db: DbExecutor,
  enrollmentId: string,
  completedPace: number
): Promise<number | null> {
  const candidate = completedPace + 1
  const others = await db
    .select({ paceNumber: paceRecords.paceNumber, status: paceRecords.status })
    .from(paceRecords)
    .where(and(eq(paceRecords.studentSubjectId, enrollmentId), ne(paceRecords.paceNumber, completedPace)))
  // Don't suggest if something is already in progress, or the next one already has a record.
  if (others.some((r) => r.status === 'active')) return null
  if (others.some((r) => r.paceNumber === candidate && r.status !== 'not_started')) return null
  return candidate <= 9999 ? candidate : null
}

export async function recordProgress(
  db: DbExecutor,
  actor: ActorContext,
  input: RecordProgressInput
): Promise<RecordProgressResult> {
  const enrollment = await findEnrollment(db, actor.householdId, input.studentId, input.subjectId)

  const [existing] = await db
    .select()
    .from(paceRecords)
    .where(
      and(
        eq(paceRecords.studentSubjectId, enrollment.enrollmentId),
        eq(paceRecords.paceNumber, input.paceNumber)
      )
    )
    .for('update')

  const previous = existing ? snapshotOf(existing) : null
  const next = nextStateFor(existing, input, actor.today)
  const eventKind = eventKindFor(previous, next)

  let record: PaceRecord
  if (existing) {
    if (!eventKind) {
      record = existing
    } else {
      ;[record] = await db
        .update(paceRecords)
        .set(next)
        .where(eq(paceRecords.id, existing.id))
        .returning()
    }
  } else {
    ;[record] = await db
      .insert(paceRecords)
      .values({
        householdId: actor.householdId,
        studentSubjectId: enrollment.enrollmentId,
        paceNumber: input.paceNumber,
        ...next
      })
      .returning()
  }

  if (eventKind) {
    await db.insert(progressEvents).values({
      householdId: actor.householdId,
      studentSubjectId: enrollment.enrollmentId,
      paceRecordId: record.id,
      paceNumber: record.paceNumber,
      kind: eventKind,
      status: record.status,
      testScore: record.testScore,
      occurredOn: record.completedOn ?? record.startedOn ?? actor.today,
      source: actor.source,
      actorUserId: actor.actorUserId,
      previous
    })
  }

  const nextPace =
    record.status === 'completed'
      ? await suggestNextPace(db, enrollment.enrollmentId, record.paceNumber)
      : null

  return {
    record,
    previous,
    eventKind,
    enrollmentId: enrollment.enrollmentId,
    studentName: enrollment.studentName,
    subjectName: enrollment.subjectName,
    nextPace
  }
}

export interface UpdateRecordInput {
  recordId: string
  paceNumber: number
  status: PaceStatus
  startedOn: IsoDate | null
  completedOn: IsoDate | null
  testScore: number | null
  notes: string | null
}

/** Direct edit of a record from its detail view (all fields explicit). */
export async function updatePaceRecord(
  db: DbExecutor,
  actor: ActorContext,
  input: UpdateRecordInput
): Promise<PaceRecord> {
  const [existing] = await db
    .select()
    .from(paceRecords)
    .where(and(eq(paceRecords.id, input.recordId), eq(paceRecords.householdId, actor.householdId)))
    .for('update')
  if (!existing) throw new ProgressError('That record no longer exists.')

  if (input.paceNumber !== existing.paceNumber) {
    const [clash] = await db
      .select({ id: paceRecords.id })
      .from(paceRecords)
      .where(
        and(
          eq(paceRecords.studentSubjectId, existing.studentSubjectId),
          eq(paceRecords.paceNumber, input.paceNumber)
        )
      )
    if (clash) {
      throw new ProgressError(`There’s already a record for PACE ${input.paceNumber} in this subject.`, 'paceNumber')
    }
  }

  let next: PaceSnapshot
  switch (input.status) {
    case 'completed':
      if (!input.completedOn) throw new ProgressError('Add the completion date.', 'completedOn')
      assertNotFuture(input.completedOn, actor.today, 'completedOn')
      assertNotFuture(input.startedOn, actor.today, 'startedOn')
      if (input.startedOn && input.completedOn < input.startedOn) {
        throw new ProgressError('Completion can’t be before the start date.', 'completedOn')
      }
      next = { status: 'completed', startedOn: input.startedOn, completedOn: input.completedOn, testScore: input.testScore, notes: input.notes }
      break
    case 'active':
      assertNotFuture(input.startedOn, actor.today, 'startedOn')
      next = { status: 'active', startedOn: input.startedOn, completedOn: null, testScore: null, notes: input.notes }
      break
    case 'not_started':
      next = { status: 'not_started', startedOn: null, completedOn: null, testScore: null, notes: input.notes }
      break
  }

  const previous = snapshotOf(existing)
  const kind = eventKindFor(previous, next)
  if (!kind && input.paceNumber === existing.paceNumber) return existing

  const [record] = await db
    .update(paceRecords)
    .set({ ...next, paceNumber: input.paceNumber })
    .where(eq(paceRecords.id, existing.id))
    .returning()

  await db.insert(progressEvents).values({
    householdId: actor.householdId,
    studentSubjectId: record.studentSubjectId,
    paceRecordId: record.id,
    paceNumber: record.paceNumber,
    kind: kind ?? 'updated',
    status: record.status,
    testScore: record.testScore,
    occurredOn: record.completedOn ?? record.startedOn ?? actor.today,
    source: actor.source,
    actorUserId: actor.actorUserId,
    previous
  })

  return record
}

export async function deletePaceRecord(
  db: DbExecutor,
  actor: ActorContext,
  recordId: string
): Promise<void> {
  const [existing] = await db
    .select()
    .from(paceRecords)
    .where(and(eq(paceRecords.id, recordId), eq(paceRecords.householdId, actor.householdId)))
    .for('update')
  if (!existing) throw new ProgressError('That record no longer exists.')

  await db.delete(paceRecords).where(eq(paceRecords.id, existing.id))
  // The audit trail outlives the record: who removed it, when, and what it said.
  await db.insert(progressEvents).values({
    householdId: actor.householdId,
    studentSubjectId: existing.studentSubjectId,
    paceRecordId: null,
    paceNumber: existing.paceNumber,
    kind: 'removed',
    status: null,
    testScore: null,
    occurredOn: actor.today,
    source: actor.source,
    actorUserId: actor.actorUserId,
    previous: snapshotOf(existing)
  })
}
