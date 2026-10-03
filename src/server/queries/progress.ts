import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import {
  addDays,
  defaultSchoolYearStart,
  diffDays,
  formatRange,
  minDate,
  periodRange,
  startOfMonth,
  startOfWeek,
  todayIn,
  type DateRange,
  type IsoDate,
  type PeriodKey
} from '@/domain/dates'
import { fullName, initials } from '@/domain/format'
import { SCHOOL_WEEKS_PER_YEAR } from '@/domain/health'
import type { DbExecutor } from '../db/client'
import { academicTerms, paceRecords, studentSubjects, students, subjects, type Household } from '../db/schema'

export type ProgressPeriod = PeriodKey | 'term'

export interface ProgressAnalytics {
  period: { key: ProgressPeriod; label: string; range: DateRange; rangeLabel: string }
  periods: Array<{ key: ProgressPeriod; label: string }>
  summary: {
    completed: number
    previousCompleted: number
    averageScore: number | null
    previousAverage: number | null
    belowPass: number
    averageDays: number | null
    expectedDays: number
  }
  weekly: Array<{ weekStart: IsoDate; completed: number; isCurrent: boolean }>
  weeklyTarget: number
  byStudent: Array<{
    studentId: string
    name: string
    initials: string
    completed: number
    expected: number
    averageScore: number | null
    averageDays: number | null
    belowPass: number
  }>
  bySubject: Array<{ subjectId: string; name: string; completed: number; averageScore: number | null; students: number }>
  yearToDate: { completed: number; expected: number; schoolYearStart: IsoDate }
  lowScores: Array<{ recordId: string; studentId: string; studentName: string; subjectName: string; paceNumber: number; score: number; completedOn: IsoDate }>
  hasAnyRecords: boolean
}

const PERIOD_LABEL: Record<ProgressPeriod, string> = {
  week: 'This week',
  last_week: 'Last week',
  month: 'This month',
  last_month: 'Last month',
  term: 'This term',
  year: 'School year'
}

const DAYS_PER_SCHOOL_YEAR = SCHOOL_WEEKS_PER_YEAR * 7

export async function getProgressAnalytics(
  db: DbExecutor,
  household: Household,
  requested: string | undefined
): Promise<ProgressAnalytics> {
  const today = todayIn(household.timezone)
  const yearStart = household.schoolYearStart ?? defaultSchoolYearStart(today)

  const [term] = await db
    .select({ name: academicTerms.name, startsOn: academicTerms.startsOn, endsOn: academicTerms.endsOn })
    .from(academicTerms)
    .where(and(eq(academicTerms.householdId, household.id), lte(academicTerms.startsOn, today), gte(academicTerms.endsOn, today)))
    .orderBy(asc(academicTerms.startsOn))
    .limit(1)

  const periods: ProgressAnalytics['periods'] = [
    { key: 'week', label: PERIOD_LABEL.week },
    { key: 'month', label: PERIOD_LABEL.month },
    { key: 'last_month', label: PERIOD_LABEL.last_month },
    ...(term ? [{ key: 'term' as const, label: term.name }] : []),
    { key: 'year', label: PERIOD_LABEL.year }
  ]
  // Without an explicit choice, show this month — or, in a month's first week, the whole of last month.
  const fallback: ProgressPeriod = diffDays(startOfMonth(today), today) < 7 ? 'last_month' : 'month'
  const key = (periods.some((p) => p.key === requested) ? requested : fallback) as ProgressPeriod
  const range: DateRange =
    key === 'term' && term ? { from: term.startsOn, to: minDate(term.endsOn, today) } : periodRange(key as PeriodKey, today, yearStart)
  const length = diffDays(range.from, range.to) + 1
  const previous: DateRange = { from: addDays(range.from, -length), to: addDays(range.from, -1) }

  const weeksBack = 12
  const firstWeek = addDays(startOfWeek(today), -7 * (weeksBack - 1))
  const loadFrom = [range.from, previous.from, firstWeek, yearStart].sort()[0]

  const [rows, enrollmentRows, anyRecord] = await Promise.all([
    db
      .select({
        recordId: paceRecords.id,
        studentId: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        subjectId: subjects.id,
        subjectName: subjects.name,
        paceNumber: paceRecords.paceNumber,
        startedOn: paceRecords.startedOn,
        completedOn: paceRecords.completedOn,
        testScore: paceRecords.testScore
      })
      .from(paceRecords)
      .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
      .innerJoin(students, eq(students.id, studentSubjects.studentId))
      .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
      .where(
        and(
          eq(paceRecords.householdId, household.id),
          eq(paceRecords.status, 'completed'),
          gte(paceRecords.completedOn, loadFrom),
          lte(paceRecords.completedOn, today)
        )
      ),
    db
      .select({
        studentId: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        sortOrder: students.sortOrder,
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectOrder: subjects.sortOrder
      })
      .from(studentSubjects)
      .innerJoin(students, eq(students.id, studentSubjects.studentId))
      .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
      .where(
        and(
          eq(studentSubjects.householdId, household.id),
          isNull(studentSubjects.archivedAt),
          isNull(students.archivedAt),
          isNull(subjects.archivedAt)
        )
      ),
    db.select({ id: paceRecords.id }).from(paceRecords).where(eq(paceRecords.householdId, household.id)).limit(1)
  ])

  const inRange = (date: string | null, r: DateRange) => date !== null && date >= r.from && date <= r.to
  const current = rows.filter((r) => inRange(r.completedOn, range))
  const prior = rows.filter((r) => inRange(r.completedOn, previous))

  const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null)
  const scores = (list: typeof rows) => list.map((r) => r.testScore).filter((s): s is number => s !== null)
  const durations = (list: typeof rows) =>
    list.filter((r) => r.startedOn && r.completedOn).map((r) => diffDays(r.startedOn!, r.completedOn!))

  // Expected completions scale with how much of the period has elapsed.
  const perEnrollmentPerDay = household.pacesPerYear / DAYS_PER_SCHOOL_YEAR
  const elapsedDays = diffDays(range.from, minDate(range.to, today)) + 1
  const enrollmentsByStudent = new Map<string, number>()
  for (const e of enrollmentRows) enrollmentsByStudent.set(e.studentId, (enrollmentsByStudent.get(e.studentId) ?? 0) + 1)

  const studentMeta = new Map<string, { name: string; initials: string; order: number }>()
  for (const e of enrollmentRows) {
    studentMeta.set(e.studentId, { name: fullName(e.firstName, e.lastName), initials: initials(e.firstName, e.lastName), order: e.sortOrder })
  }

  const byStudent = [...studentMeta.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([studentId, meta]) => {
      const mine = current.filter((r) => r.studentId === studentId)
      return {
        studentId,
        name: meta.name,
        initials: meta.initials,
        completed: mine.length,
        expected: Math.round((enrollmentsByStudent.get(studentId) ?? 0) * perEnrollmentPerDay * elapsedDays * 10) / 10,
        averageScore: avg(scores(mine)),
        averageDays: avg(durations(mine)),
        belowPass: mine.filter((r) => r.testScore !== null && r.testScore < household.passMark).length
      }
    })

  const subjectMeta = new Map<string, { name: string; order: number; students: Set<string> }>()
  for (const e of enrollmentRows) {
    const entry = subjectMeta.get(e.subjectId) ?? { name: e.subjectName, order: e.subjectOrder, students: new Set<string>() }
    entry.students.add(e.studentId)
    subjectMeta.set(e.subjectId, entry)
  }
  const bySubject = [...subjectMeta.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([subjectId, meta]) => {
      const mine = current.filter((r) => r.subjectId === subjectId)
      return { subjectId, name: meta.name, completed: mine.length, averageScore: avg(scores(mine)), students: meta.students.size }
    })

  const weekly = Array.from({ length: weeksBack }, (_, i) => {
    const weekStart = addDays(firstWeek, i * 7)
    const weekEnd = addDays(weekStart, 6)
    return {
      weekStart,
      completed: rows.filter((r) => r.completedOn! >= weekStart && r.completedOn! <= weekEnd).length,
      isCurrent: i === weeksBack - 1
    }
  })

  const yearDays = Math.max(0, diffDays(yearStart, today) + 1)
  const yearToDate = {
    completed: rows.filter((r) => r.completedOn! >= yearStart).length,
    expected: Math.round(enrollmentRows.length * perEnrollmentPerDay * Math.min(yearDays, DAYS_PER_SCHOOL_YEAR)),
    schoolYearStart: yearStart
  }

  return {
    period: { key, label: key === 'term' && term ? term.name : PERIOD_LABEL[key], range, rangeLabel: formatRange(range, today) },
    periods,
    summary: {
      completed: current.length,
      previousCompleted: prior.length,
      averageScore: avg(scores(current)),
      previousAverage: avg(scores(prior)),
      belowPass: current.filter((r) => r.testScore !== null && r.testScore < household.passMark).length,
      averageDays: avg(durations(current)),
      expectedDays: Math.round(DAYS_PER_SCHOOL_YEAR / household.pacesPerYear)
    },
    weekly,
    weeklyTarget: Math.round(enrollmentRows.length * perEnrollmentPerDay * 7 * 10) / 10,
    byStudent,
    bySubject,
    yearToDate,
    lowScores: current
      .filter((r) => r.testScore !== null && r.testScore < household.passMark)
      .sort((a, b) => (a.completedOn! < b.completedOn! ? 1 : -1))
      .map((r) => ({
        recordId: r.recordId,
        studentId: r.studentId,
        studentName: r.firstName,
        subjectName: r.subjectName,
        paceNumber: r.paceNumber,
        score: r.testScore!,
        completedOn: r.completedOn!
      })),
    hasAnyRecords: anyRecord.length > 0
  }
}

export { PERIOD_LABEL }
