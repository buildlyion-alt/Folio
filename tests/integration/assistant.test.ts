import { count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildAssistantContext } from '@/server/assistant/interpret'
import { parseOffline } from '@/server/assistant/offline-parser'
import { resolveCommand } from '@/server/assistant/resolve'
import type { ProposedChange } from '@/server/assistant/types'
import { households, paceRecords, progressEvents } from '@/server/db/schema'
import { getHouseholdOverview } from '@/server/queries/overview'
import { applyConfirmedChanges, confirmedChangesSchema } from '@/server/services/assistant'
import { createTestHousehold, NOW, openTestDatabase, removeTestHouseholds, TODAY, type TestHousehold } from './helpers'

const { db, pool } = openTestDatabase()
const created: TestHousehold[] = []
let home: TestHousehold
let other: TestHousehold

beforeAll(async () => {
  home = await createTestHousehold(db, 'assistant-home')
  other = await createTestHousehold(db, 'assistant-other')
  created.push(home, other)
})

afterAll(async () => {
  await removeTestHouseholds(db, created)
  await pool.end()
})

async function ask(household: TestHousehold, text: string) {
  const row = (await db.select().from(households).where(eq(households.id, household.householdId)))[0]
  const overview = await getHouseholdOverview(db, row, { now: NOW })
  const ctx = buildAssistantContext(overview)
  return resolveCommand(parseOffline(text, ctx), { db, household: row, ctx, provider: 'offline', notice: null })
}

async function proposals(household: TestHousehold, text: string): Promise<ProposedChange[]> {
  const response = await ask(household, text)
  if (response.type !== 'proposals') throw new Error(`Expected proposals, got ${response.type}`)
  return response.changes
}

async function writeCounts(householdId: string) {
  const [records] = await db.select({ n: count() }).from(paceRecords).where(eq(paceRecords.householdId, householdId))
  const [events] = await db.select({ n: count() }).from(progressEvents).where(eq(progressEvents.householdId, householdId))
  return { records: records.n, events: events.n }
}

/** What the confirmation UI sends back for the changes the parent kept. */
function confirm(changes: ProposedChange[]) {
  return confirmedChangesSchema.parse(
    changes.map((c) => ({
      studentId: c.studentId,
      subjectId: c.subjectId,
      paceNumber: c.paceNumber,
      status: c.status,
      testScore: c.testScore,
      date: c.date,
      notes: c.notes
    }))
  )
}

describe('assistant: interpret → confirm → write', () => {
  it('proposes two updates for the canonical sentence and writes nothing yet', async () => {
    const before = await writeCounts(home.householdId)
    const changes = await proposals(home, 'Gabriel completed Math 1084 today with 94% and started 1085')

    expect(changes).toHaveLength(2)
    expect(changes[0]).toMatchObject({
      studentId: home.student.gabriel,
      subjectId: home.subject.math,
      paceNumber: 1084,
      status: 'completed',
      testScore: 94,
      date: TODAY,
      effect: 'complete',
      existing: { status: 'active' },
      error: null
    })
    expect(changes[1]).toMatchObject({ paceNumber: 1085, status: 'active', effect: 'start', existing: null, error: null })
    expect(await writeCounts(home.householdId)).toEqual(before)
  })

  it('writes confirmed changes atomically, audited as assistant entries', async () => {
    const changes = await proposals(home, 'Gabriel completed Math 1084 today with 94% and started 1085')
    const applied = await applyConfirmedChanges(db, home.actor('assistant'), confirm(changes))

    expect(applied.map((a) => [a.paceNumber, a.status, a.testScore])).toEqual([
      [1084, 'completed', 94],
      [1085, 'active', null]
    ])
    // 1085 was started in the same batch, so there is nothing left to offer.
    expect(applied[0].nextPace).toBeNull()

    const events = await db.select().from(progressEvents).where(eq(progressEvents.householdId, home.householdId))
    const assistantEvents = events.filter((e) => e.source === 'assistant')
    expect(assistantEvents.map((e) => [e.paceNumber, e.kind])).toEqual([
      [1084, 'completed'],
      [1085, 'started']
    ])
    expect(assistantEvents.every((e) => e.actorUserId === home.userId)).toBe(true)
  })

  it('infers the active PACE when none is named (flow D)', async () => {
    const changes = await proposals(home, 'Gabriel completed Math with 91%')
    expect(changes).toMatchObject([{ paceNumber: 1085, status: 'completed', testScore: 91, effect: 'complete', error: null }])
  })

  it('reads “Gabriel completed Math 1085 with 91%” and flags the next PACE as startable after saving', async () => {
    const changes = await proposals(home, 'Gabriel completed Math 1085 with 91%')
    expect(changes).toMatchObject([{ paceNumber: 1085, status: 'completed', testScore: 91, date: TODAY, error: null }])
    const [applied] = await applyConfirmedChanges(db, home.actor('assistant'), confirm(changes))
    expect(applied).toMatchObject({ paceNumber: 1085, status: 'completed', testScore: 91, nextPace: 1086 })
  })

  it('warns before overwriting a completed PACE’s score', async () => {
    const [change] = await proposals(home, 'Gabriel completed Math 1085 with 85%')
    expect(change.effect).toBe('update')
    expect(change.warnings.join(' ')).toMatch(/91/)
  })

  it('reports unknown students and unenrolled subjects as errors instead of guessing', async () => {
    const [unknown] = await proposals(home, 'Caleb completed Math 1026 with 90%')
    expect(unknown.error).toMatch(/Caleb/)
    const [unenrolled] = await proposals(home, 'Gabriel completed Science 1080 with 90%')
    expect(unenrolled.error).toMatch(/Science/)
  })

  it('rolls back the whole batch when any change fails', async () => {
    const before = await writeCounts(home.householdId)
    const batch = confirmedChangesSchema.parse([
      { studentId: home.student.sarah, subjectId: home.subject.english, paceNumber: 1078, status: 'completed', testScore: 96, date: TODAY },
      { studentId: home.student.sarah, subjectId: home.subject.science, paceNumber: 1069, status: 'completed', testScore: 90, date: TODAY }
    ])
    await expect(applyConfirmedChanges(db, home.actor('assistant'), batch)).rejects.toThrow('Sarah isn’t taking that subject.')
    expect(await writeCounts(home.householdId)).toEqual(before)
  })

  it('refuses confirmed changes that point at another household’s student', async () => {
    const changes = await proposals(home, 'Sarah finished English 1078 yesterday, scored 91')
    const before = await writeCounts(home.householdId)
    // The other household replays the IDs it saw (or guessed); the server derives the household from the actor.
    await expect(applyConfirmedChanges(db, other.actor('assistant'), confirm(changes))).rejects.toThrow('That student isn’t in your homeschool.')
    expect(await writeCounts(home.householdId)).toEqual(before)
  })
})

describe('assistant: questions answered from records', () => {
  it('answers who completed PACEs this week from the database', async () => {
    const response = await ask(home, 'Who completed PACEs this week?')
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') return
    expect(response.summary).toMatch(/2 PACEs/)
    expect(response.rows.map((r) => r.primary).join(' ')).toMatch(/Gabriel/)
  })

  it('turns “Show scores below 80%” into a records filter', async () => {
    const response = await ask(home, 'Show scores below 80%')
    expect(response.type === 'answer' || response.type === 'navigate').toBe(true)
    const href = response.type === 'answer' ? response.link?.href : response.type === 'navigate' ? response.href : null
    expect(href).toContain('scoreMax=79')
  })
})
