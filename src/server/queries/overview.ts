import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  addDays,
  defaultSchoolYearStart,
  startOfWeek,
  todayIn,
  type IsoDate
} from '@/domain/dates'
import type {
  ActivityDTO,
  EnrollmentDTO,
  HouseholdDTO,
  HouseholdOverviewDTO,
  RosterStudentDTO,
  StudentConcernDTO,
  StudentOverviewDTO
} from '@/domain/dto'
import { fullName, initials } from '@/domain/format'
import { isConcern, studentStatusFrom, subjectSignals } from '@/domain/health'
import type { DbExecutor } from '../db/client'
import {
  paceRecords,
  progressEvents,
  studentSubjects,
  students,
  subjects,
  type Household
} from '../db/schema'

export function toHouseholdDTO(household: Household, today: IsoDate): HouseholdDTO {
  return {
    id: household.id,
    name: household.name,
    timezone: household.timezone,
    passMark: household.passMark,
    pacesPerYear: household.pacesPerYear,
    schoolYearStart: household.schoolYearStart ?? defaultSchoolYearStart(today),
    hasCustomSchoolYearStart: household.schoolYearStart !== null,
    isDemo: household.isDemo
  }
}

const num = (value: unknown): number => Number(value ?? 0)

/**
 * Everything the dashboard and students directory need, computed from the canonical
 * records in a handful of aggregate queries. Pass `studentIds` to scope it.
 */
export async function getHouseholdOverview(
  db: DbExecutor,
  household: Household,
  options: { now?: Date; studentIds?: string[]; includeArchivedStudents?: boolean } = {}
): Promise<HouseholdOverviewDTO> {
  const tz = household.timezone
  const today = todayIn(tz, options.now)
  const weekStart = startOfWeek(today)
  const lastWeekStart = addDays(weekStart, -7)
  const last30Start = addDays(today, -29)
  const dto = toHouseholdDTO(household, today)
  const yearStart = dto.schoolYearStart
  const hid = household.id
  const scope = options.studentIds

  const studentConditions = [eq(students.householdId, hid)]
  if (!options.includeArchivedStudents) studentConditions.push(isNull(students.archivedAt))
  if (scope) studentConditions.push(inArray(students.id, scope.length ? scope : ['00000000-0000-0000-0000-000000000000']))

  const [studentRows, subjectRows, enrollmentRows, activeRows, lastCompletedRows, statRows, activityRows] =
    await Promise.all([
      db
        .select({ id: students.id, firstName: students.firstName, lastName: students.lastName, level: students.level })
        .from(students)
        .where(and(...studentConditions))
        .orderBy(asc(students.sortOrder), asc(students.firstName)),
      db
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(and(eq(subjects.householdId, hid), isNull(subjects.archivedAt)))
        .orderBy(asc(subjects.sortOrder), asc(subjects.name)),
      db
        .select({ id: studentSubjects.id, studentId: studentSubjects.studentId, subjectId: studentSubjects.subjectId })
        .from(studentSubjects)
        .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
        .where(and(eq(studentSubjects.householdId, hid), isNull(studentSubjects.archivedAt), isNull(subjects.archivedAt))),
      db
        .select({
          id: paceRecords.id,
          enrollmentId: paceRecords.studentSubjectId,
          paceNumber: paceRecords.paceNumber,
          startedOn: paceRecords.startedOn,
          createdAt: paceRecords.createdAt
        })
        .from(paceRecords)
        .where(and(eq(paceRecords.householdId, hid), eq(paceRecords.status, 'active'))),
      db
        .selectDistinctOn([paceRecords.studentSubjectId], {
          id: paceRecords.id,
          enrollmentId: paceRecords.studentSubjectId,
          paceNumber: paceRecords.paceNumber,
          completedOn: paceRecords.completedOn,
          testScore: paceRecords.testScore
        })
        .from(paceRecords)
        .where(and(eq(paceRecords.householdId, hid), eq(paceRecords.status, 'completed')))
        .orderBy(paceRecords.studentSubjectId, desc(paceRecords.completedOn), desc(paceRecords.paceNumber)),
      db
        .select({
          enrollmentId: paceRecords.studentSubjectId,
          total: sql<number>`count(*)`,
          year: sql<number>`count(*) filter (where ${paceRecords.completedOn} >= ${yearStart}::date)`,
          week: sql<number>`count(*) filter (where ${paceRecords.completedOn} >= ${weekStart}::date)`,
          lastWeek: sql<number>`count(*) filter (where ${paceRecords.completedOn} >= ${lastWeekStart}::date and ${paceRecords.completedOn} < ${weekStart}::date)`,
          last30: sql<number>`count(*) filter (where ${paceRecords.completedOn} >= ${last30Start}::date)`,
          yearScoreSum: sql<number>`coalesce(sum(${paceRecords.testScore}) filter (where ${paceRecords.completedOn} >= ${yearStart}::date), 0)`,
          yearScoreCount: sql<number>`count(${paceRecords.testScore}) filter (where ${paceRecords.completedOn} >= ${yearStart}::date)`
        })
        .from(paceRecords)
        .where(and(eq(paceRecords.householdId, hid), eq(paceRecords.status, 'completed')))
        .groupBy(paceRecords.studentSubjectId),
      db
        .selectDistinctOn([studentSubjects.studentId], {
          id: progressEvents.id,
          kind: progressEvents.kind,
          source: progressEvents.source,
          status: progressEvents.status,
          paceNumber: progressEvents.paceNumber,
          testScore: progressEvents.testScore,
          occurredOn: progressEvents.occurredOn,
          createdAt: progressEvents.createdAt,
          recordId: progressEvents.paceRecordId,
          studentId: studentSubjects.studentId,
          subjectId: subjects.id,
          subjectName: subjects.name
        })
        .from(progressEvents)
        .innerJoin(studentSubjects, eq(studentSubjects.id, progressEvents.studentSubjectId))
        .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
        .where(eq(progressEvents.householdId, hid))
        .orderBy(studentSubjects.studentId, desc(progressEvents.createdAt))
    ])

  const subjectName = new Map(subjectRows.map((s) => [s.id, s.name]))
  const subjectOrder = new Map(subjectRows.map((s, i) => [s.id, i]))
  const activeByEnrollment = new Map<string, typeof activeRows>()
  for (const row of activeRows) {
    const list = activeByEnrollment.get(row.enrollmentId) ?? []
    list.push(row)
    activeByEnrollment.set(row.enrollmentId, list)
  }
  const lastCompletedByEnrollment = new Map(lastCompletedRows.map((r) => [r.enrollmentId, r]))
  const statsByEnrollment = new Map(statRows.map((r) => [r.enrollmentId, r]))
  const activityByStudent = new Map(activityRows.map((r) => [r.studentId, r]))
  const enrollmentsByStudent = new Map<string, typeof enrollmentRows>()
  for (const row of enrollmentRows) {
    const list = enrollmentsByStudent.get(row.studentId) ?? []
    list.push(row)
    enrollmentsByStudent.set(row.studentId, list)
  }

  const settings = { passMark: household.passMark, pacesPerYear: household.pacesPerYear }
  const totals = {
    students: studentRows.length,
    enrollments: 0,
    activePaces: 0,
    completedThisWeek: 0,
    completedLastWeek: 0,
    completedThisYear: 0,
    averageScore: null as number | null,
    scoredThisYear: 0,
    concerns: 0
  }
  let householdScoreSum = 0

  const studentDTOs: StudentOverviewDTO[] = studentRows.map((student) => {
    let scoreSum = 0
    let scoreCount = 0
    let completedThisWeek = 0
    let completedLastWeek = 0
    let completedThisYear = 0
    let completedLast30 = 0
    let activeCount = 0
    let hasAnyRecords = false
    const concerns: StudentConcernDTO[] = []
    const todos: StudentConcernDTO[] = []

    const enrollments: EnrollmentDTO[] = (enrollmentsByStudent.get(student.id) ?? [])
      .filter((e) => subjectName.has(e.subjectId))
      .sort((a, b) => (subjectOrder.get(a.subjectId) ?? 0) - (subjectOrder.get(b.subjectId) ?? 0))
      .map((enrollment) => {
        const actives = (activeByEnrollment.get(enrollment.id) ?? [])
          .map((r) => ({ ...r, since: r.startedOn ?? todayIn(tz, r.createdAt) }))
          .sort((a, b) => (a.since === b.since ? b.paceNumber - a.paceNumber : a.since < b.since ? 1 : -1))
        const current = actives[0] ?? null
        const last = lastCompletedByEnrollment.get(enrollment.id) ?? null
        const stats = statsByEnrollment.get(enrollment.id)
        const yearScoreCount = num(stats?.yearScoreCount)
        const yearScoreSum = num(stats?.yearScoreSum)

        scoreSum += yearScoreSum
        scoreCount += yearScoreCount
        completedThisWeek += num(stats?.week)
        completedLastWeek += num(stats?.lastWeek)
        completedThisYear += num(stats?.year)
        completedLast30 += num(stats?.last30)
        activeCount += actives.length
        if (actives.length || stats) hasAnyRecords = true

        const lastCompleted = last?.completedOn
          ? { recordId: last.id, paceNumber: last.paceNumber, completedOn: last.completedOn, testScore: last.testScore }
          : null
        const signals = subjectSignals(
          { active: current ? { paceNumber: current.paceNumber, since: current.since } : null, lastCompleted },
          settings,
          today
        )
        const name = subjectName.get(enrollment.subjectId) ?? 'Subject'
        for (const signal of signals) {
          const item = { subjectId: enrollment.subjectId, subjectName: name, signal }
          if (isConcern(signal)) concerns.push(item)
          else todos.push(item)
        }

        return {
          enrollmentId: enrollment.id,
          subjectId: enrollment.subjectId,
          subjectName: name,
          current: current
            ? { recordId: current.id, paceNumber: current.paceNumber, startedOn: current.startedOn, since: current.since }
            : null,
          otherActive: actives.slice(1).map((a) => a.paceNumber),
          lastCompleted,
          completedThisWeek: num(stats?.week),
          completedThisYear: num(stats?.year),
          completedTotal: num(stats?.total),
          averageScore: yearScoreCount ? Math.round(yearScoreSum / yearScoreCount) : null,
          signals
        }
      })

    totals.enrollments += enrollments.length
    totals.activePaces += activeCount
    totals.completedThisWeek += completedThisWeek
    totals.completedLastWeek += completedLastWeek
    totals.completedThisYear += completedThisYear
    totals.scoredThisYear += scoreCount
    householdScoreSum += scoreSum
    if (concerns.length) totals.concerns += 1

    concerns.sort((a, b) => {
      const rank = (c: StudentConcernDTO) => (c.signal.kind === 'below_pass' ? 0 : 1)
      return rank(a) - rank(b)
    })

    const activity = activityByStudent.get(student.id)
    const lastActivity: ActivityDTO | null = activity
      ? {
          id: activity.id,
          kind: activity.kind,
          source: activity.source,
          status: activity.status,
          paceNumber: activity.paceNumber,
          testScore: activity.testScore,
          occurredOn: activity.occurredOn,
          createdAt: activity.createdAt.toISOString(),
          recordId: activity.recordId,
          studentId: student.id,
          studentName: student.firstName,
          subjectId: activity.subjectId,
          subjectName: activity.subjectName
        }
      : null

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      displayName: fullName(student.firstName, student.lastName),
      initials: initials(student.firstName, student.lastName),
      level: student.level,
      enrollments,
      completedThisWeek,
      completedLastWeek,
      completedThisYear,
      completedLast30,
      averageScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
      activeCount,
      lastActivity,
      status: studentStatusFrom(concerns.map((c) => c.signal), hasAnyRecords),
      concerns,
      todos
    }
  })

  totals.averageScore = totals.scoredThisYear ? Math.round(householdScoreSum / totals.scoredThisYear) : null

  return { household: dto, today, weekStart, subjects: subjectRows, students: studentDTOs, totals }
}

/** The compact roster the Log Progress form and the assistant work from. */
export function toRoster(overview: HouseholdOverviewDTO): RosterStudentDTO[] {
  return overview.students.map((student) => ({
    id: student.id,
    firstName: student.firstName,
    displayName: student.displayName,
    initials: student.initials,
    subjects: student.enrollments.map((e) => ({
      subjectId: e.subjectId,
      subjectName: e.subjectName,
      current: e.current,
      lastCompleted: e.lastCompleted
    }))
  }))
}
