import { eq } from 'drizzle-orm'
import { defaultSchoolYearStart, type IsoDate } from '@/domain/dates'
import type { OnboardingData } from '@/domain/validation'
import type { Database } from '../db/client'
import {
  householdMembers,
  households,
  paceRecords,
  progressEvents,
  studentSubjects,
  students,
  subjects
} from '../db/schema'
import { ProgressError } from './progress'

/**
 * Creates a fully set-up homeschool in one transaction: the household, the parent's
 * membership, subjects, students, enrollments, and each student's current PACE.
 * Nothing is written until the parent confirms the final step, so an abandoned
 * onboarding leaves no half-built household behind.
 */
export async function completeOnboarding(
  db: Database,
  userId: string,
  data: OnboardingData,
  today: IsoDate
): Promise<{ householdId: string; students: number; enrollments: number }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1)
    if (existing) throw new ProgressError('Your homeschool is already set up.')

    const [household] = await tx
      .insert(households)
      .values({
        name: data.householdName,
        timezone: data.timezone,
        schoolYearStart: defaultSchoolYearStart(today),
        onboardedAt: new Date()
      })
      .returning({ id: households.id })

    await tx.insert(householdMembers).values({ householdId: household.id, userId, role: 'owner' })

    const subjectRows = await tx
      .insert(subjects)
      .values(data.subjects.map((s, i) => ({ householdId: household.id, name: s.name, sortOrder: i })))
      .returning({ id: subjects.id })
    const subjectIdByKey = new Map(data.subjects.map((s, i) => [s.key, subjectRows[i].id]))

    const studentRows = await tx
      .insert(students)
      .values(
        data.students.map((s, i) => ({
          householdId: household.id,
          firstName: s.firstName,
          lastName: s.lastName,
          level: s.level,
          sortOrder: i
        }))
      )
      .returning({ id: students.id })
    const studentIdByKey = new Map(data.students.map((s, i) => [s.key, studentRows[i].id]))

    if (data.positions.length > 0) {
      const enrollmentRows = await tx
        .insert(studentSubjects)
        .values(
          data.positions.map((p) => ({
            householdId: household.id,
            studentId: studentIdByKey.get(p.studentKey)!,
            subjectId: subjectIdByKey.get(p.subjectKey)!
          }))
        )
        .returning({ id: studentSubjects.id })

      // Current positions: active PACEs whose start date is unknown (they began before Folio).
      const recordRows = await tx
        .insert(paceRecords)
        .values(
          data.positions.map((p, i) => ({
            householdId: household.id,
            studentSubjectId: enrollmentRows[i].id,
            paceNumber: p.paceNumber,
            status: 'active' as const
          }))
        )
        .returning({ id: paceRecords.id, studentSubjectId: paceRecords.studentSubjectId, paceNumber: paceRecords.paceNumber })

      await tx.insert(progressEvents).values(
        recordRows.map((r) => ({
          householdId: household.id,
          studentSubjectId: r.studentSubjectId,
          paceRecordId: r.id,
          paceNumber: r.paceNumber,
          kind: 'started' as const,
          status: 'active' as const,
          occurredOn: today,
          source: 'onboarding' as const,
          actorUserId: userId
        }))
      )
    }

    return {
      householdId: household.id,
      students: studentRows.length,
      enrollments: data.positions.length
    }
  })
}
