import { and, asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { paceRecords, progressEvents, studentSubjects } from '@/server/db/schema'
import { getHouseholdOverview } from '@/server/queries/overview'
import { listRecords, parseRecordFilters } from '@/server/queries/records'
import { deletePaceRecord, ProgressError, recordProgress, updatePaceRecord } from '@/server/services/progress'
import { createTestHousehold, enrollmentId, NOW, openTestDatabase, removeTestHouseholds, TODAY, type TestHousehold } from './helpers'

const { db, pool } = openTestDatabase()
const created: TestHousehold[] = []
let home: TestHousehold
let other: TestHousehold

beforeAll(async () => {
  home = await createTestHousehold(db, 'progress-home')
  other = await createTestHousehold(db, 'progress-other')
  created.push(home, other)
})

afterAll(async () => {
  await removeTestHouseholds(db, created)
  await pool.end()
})

async function recordsFor(household: TestHousehold, studentId: string, subjectId: string) {
  const enrollment = await enrollmentId(db, household.householdId, studentId, subjectId)
  return db.select().from(paceRecords).where(eq(paceRecords.studentSubjectId, enrollment)).orderBy(asc(paceRecords.paceNumber))
}

async function eventsFor(household: TestHousehold, studentId: string, subjectId: string) {
  const enrollment = await enrollmentId(db, household.householdId, studentId, subjectId)
  return db.select().from(progressEvents).where(eq(progressEvents.studentSubjectId, enrollment)).orderBy(asc(progressEvents.createdAt))
}

describe('onboarding', () => {
  it('creates each current PACE as an active record with an unknown start date, audited as onboarding', async () => {
    const records = await recordsFor(home, home.student.gabriel, home.subject.math)
    expect(records).toMatchObject([{ paceNumber: 1084, status: 'active', startedOn: null, completedOn: null, testScore: null }])
    const events = await eventsFor(home, home.student.gabriel, home.subject.math)
    expect(events).toMatchObject([{ kind: 'started', paceNumber: 1084, source: 'onboarding', actorUserId: home.userId }])
  })
})

describe('recordProgress — the single write path', () => {
  it('completes the active PACE, keeps an audit snapshot, and offers the next one (flow B)', async () => {
    const result = await recordProgress(db, home.actor(), {
      studentId: home.student.gabriel,
      subjectId: home.subject.math,
      paceNumber: 1084,
      status: 'completed',
      testScore: 94,
      date: TODAY
    })
    expect(result.eventKind).toBe('completed')
    expect(result.record).toMatchObject({ paceNumber: 1084, status: 'completed', completedOn: TODAY, testScore: 94 })
    expect(result.previous).toMatchObject({ status: 'active', testScore: null })
    expect(result.nextPace).toBe(1085)

    const events = await eventsFor(home, home.student.gabriel, home.subject.math)
    expect(events.at(-1)).toMatchObject({ kind: 'completed', testScore: 94, source: 'manual', previous: { status: 'active' } })
  })

  it('shows the result everywhere that reads progress: overview totals, current PACE and the records list', async () => {
    const household = (await db.query.households.findFirst({ where: (h, { eq }) => eq(h.id, home.householdId) }))!
    const overview = await getHouseholdOverview(db, household, { now: NOW })
    const gabriel = overview.students.find((s) => s.id === home.student.gabriel)!
    const math = gabriel.enrollments.find((e) => e.subjectId === home.subject.math)!
    expect(math.current).toBeNull()
    expect(math.lastCompleted).toMatchObject({ paceNumber: 1084, completedOn: TODAY, testScore: 94 })
    expect(gabriel.completedThisWeek).toBe(1)
    expect(overview.totals.completedThisWeek).toBe(1)
    expect(math.signals).toEqual([{ kind: 'no_active', nextPace: 1085 }])

    const filters = parseRecordFilters({ student: home.student.gabriel, subject: home.subject.math })
    const { rows } = await listRecords(db, home.householdId, filters)
    expect(rows.map((r) => [r.paceNumber, r.status, r.testScore])).toEqual([[1084, 'completed', 94]])
  })

  it('starts the next PACE, after which no further “start next” is suggested', async () => {
    const started = await recordProgress(db, home.actor(), {
      studentId: home.student.gabriel,
      subjectId: home.subject.math,
      paceNumber: 1085,
      status: 'active',
      testScore: null,
      date: TODAY
    })
    expect(started).toMatchObject({ eventKind: 'started', nextPace: null, record: { status: 'active', startedOn: TODAY } })
  })

  it('writes no event when an entry changes nothing', async () => {
    const before = (await eventsFor(home, home.student.gabriel, home.subject.math)).length
    const again = await recordProgress(db, home.actor(), {
      studentId: home.student.gabriel,
      subjectId: home.subject.math,
      paceNumber: 1084,
      status: 'completed',
      testScore: 94,
      date: TODAY
    })
    expect(again.eventKind).toBeNull()
    expect(await eventsFor(home, home.student.gabriel, home.subject.math)).toHaveLength(before)
  })

  it('records a score correction as an update with the previous value kept', async () => {
    const corrected = await recordProgress(db, home.actor(), {
      studentId: home.student.gabriel,
      subjectId: home.subject.math,
      paceNumber: 1084,
      status: 'completed',
      testScore: 95,
      date: TODAY
    })
    expect(corrected.eventKind).toBe('updated')
    expect(corrected.previous).toMatchObject({ testScore: 94 })
  })

  it('rejects future dates and completions before the start date', async () => {
    const base = { studentId: home.student.sarah, subjectId: home.subject.english, testScore: null }
    await expect(recordProgress(db, home.actor(), { ...base, paceNumber: 1078, status: 'completed', date: '2026-10-03' })).rejects.toThrow(
      'Dates can’t be in the future.'
    )
    await recordProgress(db, home.actor(), { ...base, paceNumber: 1079, status: 'active', date: '2026-09-30' })
    await expect(recordProgress(db, home.actor(), { ...base, paceNumber: 1079, status: 'completed', date: '2026-09-29' })).rejects.toThrow(
      /can’t be completed before then/
    )
  })

  it('refuses a subject the student isn’t enrolled in', async () => {
    await expect(
      recordProgress(db, home.actor(), {
        studentId: home.student.gabriel,
        subjectId: home.subject.science,
        paceNumber: 1080,
        status: 'completed',
        testScore: 90,
        date: TODAY
      })
    ).rejects.toThrow('Gabriel isn’t taking that subject.')
  })

  it('enforces score rules in the database, not only in the app', async () => {
    const enrollment = await enrollmentId(db, home.householdId, home.student.sarah, home.subject.math)
    await expect(
      db.insert(paceRecords).values({ householdId: home.householdId, studentSubjectId: enrollment, paceNumber: 1090, status: 'active', testScore: 80 })
    ).rejects.toThrow()
  })
})

describe('record edits and removal', () => {
  it('edits a record and refuses to renumber it onto an existing PACE', async () => {
    const [record] = (await recordsFor(home, home.student.sarah, home.subject.math)).filter((r) => r.paceNumber === 1072)
    const edited = await updatePaceRecord(db, home.actor(), {
      recordId: record.id,
      paceNumber: 1072,
      status: 'completed',
      startedOn: '2026-09-14',
      completedOn: '2026-09-30',
      testScore: 88,
      notes: 'Retook the Self Test'
    })
    expect(edited).toMatchObject({ status: 'completed', testScore: 88, notes: 'Retook the Self Test' })

    await recordProgress(db, home.actor(), {
      studentId: home.student.sarah,
      subjectId: home.subject.math,
      paceNumber: 1073,
      status: 'active',
      testScore: null,
      date: TODAY
    })
    await expect(
      updatePaceRecord(db, home.actor(), { ...edited, recordId: edited.id, paceNumber: 1073, notes: edited.notes })
    ).rejects.toThrow('There’s already a record for PACE 1073 in this subject.')
  })

  it('deletes a record but keeps a “removed” event with what it said', async () => {
    const [record] = (await recordsFor(home, home.student.sarah, home.subject.math)).filter((r) => r.paceNumber === 1073)
    await deletePaceRecord(db, home.actor(), record.id)
    expect((await recordsFor(home, home.student.sarah, home.subject.math)).map((r) => r.paceNumber)).toEqual([1072])
    const events = await eventsFor(home, home.student.sarah, home.subject.math)
    expect(events.at(-1)).toMatchObject({ kind: 'removed', paceNumber: 1073, paceRecordId: null, previous: { status: 'active' } })
    // The started event for 1073 survives with its link cleared.
    expect(events.filter((e) => e.paceNumber === 1073).every((e) => e.paceRecordId === null)).toBe(true)
  })
})

describe('household isolation', () => {
  it('won’t write progress for another household’s student', async () => {
    const attempt = recordProgress(db, other.actor(), {
      studentId: home.student.gabriel,
      subjectId: home.subject.english,
      paceNumber: 1081,
      status: 'completed',
      testScore: 100,
      date: TODAY
    })
    await expect(attempt).rejects.toBeInstanceOf(ProgressError)
    await expect(attempt).rejects.toThrow('That student isn’t in your homeschool.')
    const [english] = await recordsFor(home, home.student.gabriel, home.subject.english)
    expect(english).toMatchObject({ paceNumber: 1081, status: 'active', testScore: null })
  })

  it('won’t mix one household’s student with another household’s subject', async () => {
    await expect(
      recordProgress(db, other.actor(), {
        studentId: other.student.gabriel,
        subjectId: home.subject.math,
        paceNumber: 1084,
        status: 'completed',
        testScore: 100,
        date: TODAY
      })
    ).rejects.toThrow('Gabriel isn’t taking that subject.')
  })

  it('won’t edit or delete another household’s record', async () => {
    const [english] = await recordsFor(home, home.student.gabriel, home.subject.english)
    await expect(
      updatePaceRecord(db, other.actor(), {
        recordId: english.id,
        paceNumber: 1081,
        status: 'completed',
        startedOn: null,
        completedOn: TODAY,
        testScore: 100,
        notes: null
      })
    ).rejects.toThrow('That record no longer exists.')
    await expect(deletePaceRecord(db, other.actor(), english.id)).rejects.toThrow('That record no longer exists.')
    const [after] = await recordsFor(home, home.student.gabriel, home.subject.english)
    expect(after).toMatchObject({ id: english.id, status: 'active' })
  })

  it('rejects cross-household rows at the database level too', async () => {
    // A student from one household enrolled in a subject from another breaks the composite keys.
    await expect(
      db.insert(studentSubjects).values({ householdId: other.householdId, studentId: home.student.gabriel, subjectId: other.subject.science })
    ).rejects.toThrow()
    await expect(
      db.insert(studentSubjects).values({ householdId: home.householdId, studentId: home.student.gabriel, subjectId: other.subject.science })
    ).rejects.toThrow()
    const rows = await db
      .select()
      .from(studentSubjects)
      .where(and(eq(studentSubjects.studentId, home.student.gabriel), eq(studentSubjects.subjectId, other.subject.science)))
    expect(rows).toHaveLength(0)
  })
})
