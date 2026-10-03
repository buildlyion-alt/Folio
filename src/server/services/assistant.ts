import * as z from 'zod'
import { progressEntrySchema } from '@/domain/validation'
import type { Database } from '../db/client'
import { recordProgress, type ActorContext } from './progress'

export const confirmedChangesSchema = z
  .array(progressEntrySchema.extend({ notes: z.string().max(2000).nullable().optional() }))
  .min(1)
  .max(20)

export type ConfirmedChange = z.output<typeof confirmedChangesSchema>[number]

export interface AppliedChange {
  studentId: string
  studentName: string
  subjectId: string
  subjectName: string
  paceNumber: number
  status: 'not_started' | 'active' | 'completed'
  testScore: number | null
  nextPace: number | null
  recordId: string
}

/**
 * Writes assistant proposals the parent confirmed — all or nothing, through the same
 * validated write path as the Log Progress form. Every ID is re-checked against the
 * actor's household inside recordProgress, so a tampered change fails instead of writing.
 */
export async function applyConfirmedChanges(
  db: Database,
  actor: ActorContext,
  changes: ConfirmedChange[]
): Promise<AppliedChange[]> {
  return db.transaction(async (tx) => {
    const results: AppliedChange[] = []
    for (const change of changes) {
      const result = await recordProgress(tx, actor, {
        studentId: change.studentId,
        subjectId: change.subjectId,
        paceNumber: change.paceNumber,
        status: change.status,
        testScore: change.status === 'completed' ? change.testScore : null,
        date: change.status === 'not_started' ? null : (change.date ?? actor.today),
        notes: change.notes ?? undefined
      })
      results.push({
        studentId: change.studentId,
        studentName: result.studentName,
        subjectId: change.subjectId,
        subjectName: result.subjectName,
        paceNumber: result.record.paceNumber,
        status: result.record.status,
        testScore: result.record.testScore,
        nextPace: result.nextPace,
        recordId: result.record.id
      })
    }
    // A later change in the batch may have started the suggested next PACE already.
    return results.map((r) => ({
      ...r,
      nextPace:
        r.nextPace && results.some((o) => o.subjectId === r.subjectId && o.studentId === r.studentId && o.paceNumber === r.nextPace)
          ? null
          : r.nextPace
    }))
  })
}
