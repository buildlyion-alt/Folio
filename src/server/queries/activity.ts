import { and, desc, eq, notInArray } from 'drizzle-orm'
import type { ActivityDTO } from '@/domain/dto'
import type { DbExecutor } from '../db/client'
import { progressEvents, studentSubjects, students, subjects } from '../db/schema'

export async function getRecentActivity(
  db: DbExecutor,
  householdId: string,
  options: {
    limit?: number
    studentId?: string
    recordId?: string
    excludeSources?: Array<'manual' | 'assistant' | 'onboarding' | 'demo'>
  } = {}
): Promise<ActivityDTO[]> {
  const conditions = [eq(progressEvents.householdId, householdId)]
  if (options.studentId) conditions.push(eq(studentSubjects.studentId, options.studentId))
  if (options.recordId) conditions.push(eq(progressEvents.paceRecordId, options.recordId))
  if (options.excludeSources?.length) conditions.push(notInArray(progressEvents.source, options.excludeSources))

  const rows = await db
    .select({
      id: progressEvents.id,
      kind: progressEvents.kind,
      source: progressEvents.source,
      status: progressEvents.status,
      paceNumber: progressEvents.paceNumber,
      testScore: progressEvents.testScore,
      occurredOn: progressEvents.occurredOn,
      createdAt: progressEvents.createdAt,
      recordId: progressEvents.paceRecordId,
      studentId: students.id,
      studentName: students.firstName,
      subjectId: subjects.id,
      subjectName: subjects.name
    })
    .from(progressEvents)
    .innerJoin(studentSubjects, eq(studentSubjects.id, progressEvents.studentSubjectId))
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(and(...conditions))
    .orderBy(desc(progressEvents.createdAt))
    .limit(options.limit ?? 12)

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}
