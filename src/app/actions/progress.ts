'use server'

import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { todayIn } from '@/domain/dates'
import type { ActivityDTO, RecordDTO } from '@/domain/dto'
import { progressEntrySchema, recordUpdateSchema, type ProgressEntryInput } from '@/domain/validation'
import { getDb } from '@/server/db'
import { getHouseholdContext, type HouseholdContext } from '@/server/auth/context'
import { getRecentActivity } from '@/server/queries/activity'
import { getRecord } from '@/server/queries/records'
import {
  deletePaceRecord,
  ProgressError,
  recordProgress,
  updatePaceRecord,
  type ActorContext
} from '@/server/services/progress'

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; field?: string }

export interface LoggedProgress {
  recordId: string
  studentId: string
  studentName: string
  subjectId: string
  subjectName: string
  paceNumber: number
  status: 'not_started' | 'active' | 'completed'
  testScore: number | null
  changed: boolean
  nextPace: number | null
}

function actorFor(ctx: HouseholdContext, source: ActorContext['source'] = 'manual'): ActorContext {
  return {
    householdId: ctx.household.id,
    actorUserId: ctx.user.id,
    source,
    today: todayIn(ctx.household.timezone)
  }
}

const SIGNED_OUT = { ok: false as const, error: 'Your session has ended. Sign in again to continue.' }

function failure(error: unknown): { ok: false; error: string; field?: string } {
  if (error instanceof ProgressError) return { ok: false, error: error.message, field: error.field }
  console.error(error)
  return { ok: false, error: 'Something went wrong saving that. Please try again.' }
}

/** One entry from the Log Progress form. Writes the record, its audit event, and refreshes every view. */
export async function logProgress(input: ProgressEntryInput): Promise<ActionResult<LoggedProgress>> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = progressEntrySchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Check the entry and try again.', field: issue?.path[0]?.toString() }
  }
  const entry = parsed.data
  if (entry.status === 'completed' && !entry.date) return { ok: false, error: 'Add the completion date.', field: 'date' }

  try {
    const result = await getDb().transaction((tx) =>
      recordProgress(tx, actorFor(ctx), {
        studentId: entry.studentId,
        subjectId: entry.subjectId,
        paceNumber: entry.paceNumber,
        status: entry.status,
        testScore: entry.status === 'completed' ? entry.testScore : null,
        date: entry.status === 'not_started' ? null : entry.date,
        notes: entry.notes
      })
    )
    revalidatePath('/', 'layout')
    return {
      ok: true,
      data: {
        recordId: result.record.id,
        studentId: entry.studentId,
        studentName: result.studentName,
        subjectId: entry.subjectId,
        subjectName: result.subjectName,
        paceNumber: result.record.paceNumber,
        status: result.record.status,
        testScore: result.record.testScore,
        changed: result.eventKind !== null,
        nextPace: result.nextPace
      }
    }
  } catch (error) {
    return failure(error)
  }
}

const startSchema = z.object({ studentId: z.uuid(), subjectId: z.uuid(), paceNumber: z.number().int().min(1).max(9999) })

/** "Start 1085" — the one-click follow-up after completing a PACE. */
export async function startPace(input: z.input<typeof startSchema>): Promise<ActionResult> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'That PACE couldn’t be started.' }
  try {
    const actor = actorFor(ctx)
    await getDb().transaction((tx) =>
      recordProgress(tx, actor, { ...parsed.data, status: 'active', testScore: null, date: actor.today })
    )
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export interface RecordDetail {
  record: RecordDTO
  history: ActivityDTO[]
  passMark: number
  today: string
}

export async function getRecordDetail(recordId: string): Promise<ActionResult<RecordDetail>> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  if (!z.uuid().safeParse(recordId).success) return { ok: false, error: 'That record doesn’t exist.' }
  const db = getDb()
  const record = await getRecord(db, ctx.household.id, recordId)
  if (!record) return { ok: false, error: 'That record doesn’t exist anymore.' }
  const history = await getRecentActivity(db, ctx.household.id, { recordId, limit: 50 })
  return {
    ok: true,
    data: { record, history, passMark: ctx.household.passMark, today: todayIn(ctx.household.timezone) }
  }
}

export async function updateRecord(input: z.input<typeof recordUpdateSchema>): Promise<ActionResult> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = recordUpdateSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Check the record and try again.', field: issue?.path[0]?.toString() }
  }
  try {
    await getDb().transaction((tx) => updatePaceRecord(tx, actorFor(ctx), parsed.data))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function deleteRecord(recordId: string): Promise<ActionResult> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  if (!z.uuid().safeParse(recordId).success) return { ok: false, error: 'That record doesn’t exist.' }
  try {
    await getDb().transaction((tx) => deletePaceRecord(tx, actorFor(ctx), recordId))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}
