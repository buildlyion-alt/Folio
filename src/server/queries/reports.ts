import { and, asc, eq, isNull } from 'drizzle-orm'
import * as z from 'zod'
import {
  defaultSchoolYearStart,
  endOfMonth,
  formatLongDate,
  formatMonth,
  formatRange,
  formatTableDate,
  isIsoDate,
  minDate,
  periodRange,
  startOfMonth,
  todayIn,
  type DateRange
} from '@/domain/dates'
import { fullName, listJoin, plural } from '@/domain/format'
import { averageScore, formatScore, paceLevel } from '@/domain/pace'
import type { DbExecutor } from '../db/client'
import { paceRecords, studentSubjects, students, subjects, type Household } from '../db/schema'

/*
 * Reports are built as data first — a typed document of summary sentences, KPI rows and
 * tables — and rendered second. The same document drives the printable page and the CSV
 * export, so adding another output (PDF, email) means adding a renderer, not a report.
 * Every number comes from stored records; the summary sentences are templated from
 * those numbers, never generated.
 */

export const REPORT_TYPES = ['weekly', 'monthly', 'student', 'subject', 'scores', 'completed', 'summary'] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_INFO: Record<ReportType, { title: string; description: string; needs?: 'student' | 'subject'; defaultPeriod: 'week' | 'month' | 'year' }> = {
  weekly: { title: 'Weekly progress', description: 'PACEs completed this week, by child and subject, with scores.', defaultPeriod: 'week' },
  monthly: { title: 'Monthly progress', description: 'A month of completions, averages and anything that needs review.', defaultPeriod: 'month' },
  student: { title: 'Student progress', description: 'One child’s subjects, current PACEs, scores and completed work.', needs: 'student', defaultPeriod: 'year' },
  subject: { title: 'Subject progress', description: 'Where every child stands in one subject.', needs: 'subject', defaultPeriod: 'year' },
  scores: { title: 'Test score history', description: 'Every PACE Test score in the period, with averages and retests needed.', defaultPeriod: 'year' },
  completed: { title: 'Completed PACEs', description: 'A dated list of every PACE completed — useful for portfolios and records.', defaultPeriod: 'year' },
  summary: { title: 'Academic summary', description: 'The school year at a glance for every child: completions, averages, current levels.', defaultPeriod: 'year' }
}

export const reportParamsSchema = z.object({
  from: z.string().refine(isIsoDate).optional().catch(undefined),
  to: z.string().refine(isIsoDate).optional().catch(undefined),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined),
  student: z.uuid().optional().catch(undefined),
  subject: z.uuid().optional().catch(undefined)
})
export type ReportParams = z.output<typeof reportParamsSchema>

export interface ReportColumn {
  key: string
  label: string
  align?: 'end'
  mono?: boolean
}

export type ReportSection =
  | { kind: 'kpis'; items: Array<{ label: string; value: string; meta?: string }> }
  | { kind: 'table'; title: string; columns: ReportColumn[]; rows: Array<Record<string, string>>; empty: string; flags?: number[] }

export interface ReportDocument {
  type: ReportType
  title: string
  subtitle: string | null
  householdName: string
  range: DateRange
  periodLabel: string
  generatedOn: string
  summary: string[]
  sections: ReportSection[]
  csv: { filename: string; header: string[]; rows: Array<Array<string | number | null>> }
}

export class ReportInputError extends Error {}

function resolveRange(type: ReportType, params: ReportParams, today: string, yearStart: string): DateRange {
  if (params.month) {
    const from = `${params.month}-01`
    return { from, to: minDate(endOfMonth(from), today) }
  }
  if (params.from && params.to && params.from <= params.to) return { from: params.from, to: minDate(params.to, today) }
  const fallback = REPORT_INFO[type].defaultPeriod
  if (fallback === 'week') return periodRange('week', today, yearStart)
  if (fallback === 'month') return { from: startOfMonth(today), to: today }
  return { from: yearStart, to: today }
}

function periodLabelFor(range: DateRange, today: string, yearStart: string): string {
  if (range.from === startOfMonth(range.from) && (range.to === endOfMonth(range.from) || (range.to === today && range.from === startOfMonth(today)))) {
    return formatMonth(range.from)
  }
  if (range.from === yearStart) return `School year to date · ${formatRange(range, today)}`
  return formatRange(range, today)
}

export async function buildReport(
  db: DbExecutor,
  household: Household,
  type: ReportType,
  rawParams: Record<string, string | string[] | undefined>
): Promise<ReportDocument> {
  const params = reportParamsSchema.parse(
    Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v))
  )
  const today = todayIn(household.timezone)
  const yearStart = household.schoolYearStart ?? defaultSchoolYearStart(today)
  const range = resolveRange(type, params, today, yearStart)
  const passMark = household.passMark

  const enrollmentRows = await db
    .select({
      enrollmentId: studentSubjects.id,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      studentOrder: students.sortOrder,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectOrder: subjects.sortOrder
    })
    .from(studentSubjects)
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(and(eq(studentSubjects.householdId, household.id), isNull(studentSubjects.archivedAt), isNull(students.archivedAt)))
    .orderBy(asc(students.sortOrder), asc(subjects.sortOrder))

  const studentFilter = type === 'student' ? params.student : undefined
  const subjectFilter = type === 'subject' ? params.subject : undefined
  if (type === 'student' && !enrollmentRows.some((e) => e.studentId === params.student)) {
    throw new ReportInputError('Choose a student for this report.')
  }
  if (type === 'subject' && !enrollmentRows.some((e) => e.subjectId === params.subject)) {
    throw new ReportInputError('Choose a subject for this report.')
  }

  const conditions = [eq(paceRecords.householdId, household.id)]
  if (studentFilter) conditions.push(eq(studentSubjects.studentId, studentFilter))
  if (subjectFilter) conditions.push(eq(studentSubjects.subjectId, subjectFilter))

  const records = await db
    .select({
      id: paceRecords.id,
      enrollmentId: paceRecords.studentSubjectId,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      subjectId: subjects.id,
      subjectName: subjects.name,
      paceNumber: paceRecords.paceNumber,
      status: paceRecords.status,
      startedOn: paceRecords.startedOn,
      completedOn: paceRecords.completedOn,
      testScore: paceRecords.testScore,
      notes: paceRecords.notes
    })
    .from(paceRecords)
    .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(and(...conditions))
    .orderBy(asc(paceRecords.completedOn))

  const completed = records
    .filter((r) => r.status === 'completed' && r.completedOn! >= range.from && r.completedOn! <= range.to)
    .sort((a, b) => (a.completedOn! < b.completedOn! ? -1 : a.completedOn! > b.completedOn! ? 1 : a.firstName.localeCompare(b.firstName)))
  const scored = completed.filter((r) => r.testScore !== null)
  const below = scored.filter((r) => r.testScore! < passMark)
  const active = records.filter((r) => r.status === 'active')

  const studentsInScope = [...new Map(enrollmentRows.filter((e) => !studentFilter || e.studentId === studentFilter).map((e) => [e.studentId, e])).values()]
  const scopeEnrollments = enrollmentRows.filter((e) => (!studentFilter || e.studentId === studentFilter) && (!subjectFilter || e.subjectId === subjectFilter))

  const name = (r: { firstName: string }) => r.firstName
  const scoreText = (n: number | null) => formatScore(n)
  const date = (d: string | null) => (d ? formatTableDate(d, today) : '—')
  const avg = (list: typeof completed) => averageScore(list.map((r) => r.testScore))

  const kpis: ReportSection = {
    kind: 'kpis',
    items: [
      { label: 'PACEs completed', value: String(completed.length), meta: studentsInScope.length > 1 ? `by ${plural(new Set(completed.map((r) => r.studentId)).size, 'student')}` : undefined },
      { label: 'Average test score', value: scoreText(avg(completed)), meta: `${plural(scored.length, 'test')}` },
      { label: `Below ${passMark}%`, value: String(below.length), meta: below.length ? 'need review' : 'all passed' },
      { label: 'In progress now', value: String(active.filter((r) => scopeEnrollments.some((e) => e.enrollmentId === r.enrollmentId)).length) }
    ]
  }

  const completedTable = (title = 'Completed PACEs'): ReportSection => ({
    kind: 'table',
    title,
    columns: [
      { key: 'date', label: 'Completed' },
      ...(studentFilter ? [] : [{ key: 'student', label: 'Student' }]),
      ...(subjectFilter ? [] : [{ key: 'subject', label: 'Subject' }]),
      { key: 'pace', label: 'PACE', mono: true },
      { key: 'score', label: 'Score', align: 'end' as const },
      { key: 'notes', label: 'Notes' }
    ],
    rows: completed.map((r) => ({
      date: date(r.completedOn),
      student: name(r),
      subject: r.subjectName,
      pace: String(r.paceNumber),
      score: scoreText(r.testScore),
      notes: r.notes ?? ''
    })),
    flags: completed.map((r, i) => (r.testScore !== null && r.testScore < passMark ? i : -1)).filter((i) => i >= 0),
    empty: 'No PACEs were completed in this period.'
  })

  const byStudentTable: ReportSection = {
    kind: 'table',
    title: 'By student',
    columns: [
      { key: 'student', label: 'Student' },
      { key: 'count', label: 'Completed', align: 'end' },
      { key: 'avg', label: 'Avg. score', align: 'end' },
      { key: 'paces', label: 'PACEs' }
    ],
    rows: studentsInScope.map((s) => {
      const mine = completed.filter((r) => r.studentId === s.studentId)
      return {
        student: fullName(s.firstName, s.lastName),
        count: String(mine.length),
        avg: scoreText(avg(mine)),
        paces: mine.map((r) => `${r.subjectName} ${r.paceNumber}${r.testScore !== null ? ` (${r.testScore}%)` : ''}`).join(', ') || '—'
      }
    }),
    empty: 'No students.'
  }

  const subjectNames = [...new Map(scopeEnrollments.map((e) => [e.subjectId, e.subjectName])).entries()]
  const bySubjectTable: ReportSection = {
    kind: 'table',
    title: 'By subject',
    columns: [
      { key: 'subject', label: 'Subject' },
      { key: 'count', label: 'Completed', align: 'end' },
      { key: 'avg', label: 'Avg. score', align: 'end' }
    ],
    rows: subjectNames.map(([id, subjectName]) => {
      const mine = completed.filter((r) => r.subjectId === id)
      return { subject: subjectName, count: String(mine.length), avg: scoreText(avg(mine)) }
    }),
    empty: 'No subjects.'
  }

  const positionsTable = (title: string): ReportSection => ({
    kind: 'table',
    title,
    columns: [
      ...(studentFilter ? [] : [{ key: 'student', label: 'Student' }]),
      ...(subjectFilter ? [] : [{ key: 'subject', label: 'Subject' }]),
      { key: 'current', label: 'Current PACE', mono: true },
      { key: 'level', label: 'Level', align: 'end' as const },
      { key: 'count', label: 'Completed', align: 'end' as const },
      { key: 'avg', label: 'Avg. score', align: 'end' as const },
      { key: 'last', label: 'Last score', align: 'end' as const }
    ],
    rows: scopeEnrollments.map((e) => {
      const current = active.filter((r) => r.enrollmentId === e.enrollmentId).sort((a, b) => b.paceNumber - a.paceNumber)[0]
      const done = completed.filter((r) => r.enrollmentId === e.enrollmentId)
      const last = records.filter((r) => r.enrollmentId === e.enrollmentId && r.status === 'completed').at(-1)
      const level = current ? paceLevel(current.paceNumber) : null
      return {
        student: e.firstName,
        subject: e.subjectName,
        current: current ? String(current.paceNumber) : '—',
        level: level ? String(level) : '—',
        count: String(done.length),
        avg: scoreText(avg(done)),
        last: scoreText(last?.testScore ?? null)
      }
    }),
    empty: 'No subjects.'
  })

  const belowTable: ReportSection = {
    kind: 'table',
    title: `Scores below the ${passMark}% pass mark`,
    columns: [
      { key: 'date', label: 'Completed' },
      { key: 'student', label: 'Student' },
      { key: 'subject', label: 'Subject' },
      { key: 'pace', label: 'PACE', mono: true },
      { key: 'score', label: 'Score', align: 'end' }
    ],
    rows: below.map((r) => ({ date: date(r.completedOn), student: name(r), subject: r.subjectName, pace: String(r.paceNumber), score: scoreText(r.testScore) })),
    flags: below.map((_, i) => i),
    empty: 'Every test in this period met the pass mark.'
  }

  // Summary sentences, templated from the numbers above.
  const summary: string[] = []
  const periodLabel = periodLabelFor(range, today, yearStart)
  const who = studentFilter ? studentsInScope[0]?.firstName : subjectFilter ? `${plural(new Set(scopeEnrollments.map((e) => e.studentId)).size, 'student')} in ${subjectNames[0]?.[1]}` : plural(studentsInScope.length, 'student')
  if (completed.length === 0) {
    summary.push(`No PACEs were completed ${studentFilter ? `by ${who} ` : ''}in this period.`)
  } else {
    const average = avg(completed)
    summary.push(
      `${capitalize(who ?? 'Students')} completed ${plural(completed.length, 'PACE')}${average !== null ? ` with an average test score of ${average}%` : ''}.`
    )
    if (!studentFilter && studentsInScope.length > 1) {
      const counts = studentsInScope.map((s) => ({ name: s.firstName, count: completed.filter((r) => r.studentId === s.studentId).length }))
      const top = Math.max(...counts.map((c) => c.count))
      const leaders = counts.filter((c) => c.count === top).map((c) => c.name)
      summary.push(`${listJoin(leaders)} completed the most (${top}).`)
    }
    summary.push(
      below.length
        ? `${plural(below.length, 'test')} fell below the ${passMark}% pass mark: ${listJoin(below.map((r) => `${r.firstName} — ${r.subjectName} ${r.paceNumber} (${r.testScore}%)`))}.`
        : `Every test met the ${passMark}% pass mark.`
    )
  }

  const info = REPORT_INFO[type]
  let sections: ReportSection[]
  let subtitle: string | null = null
  switch (type) {
    case 'weekly':
    case 'monthly':
      sections = [kpis, byStudentTable, bySubjectTable, completedTable(), belowTable]
      break
    case 'student':
      subtitle = fullName(studentsInScope[0].firstName, studentsInScope[0].lastName)
      sections = [kpis, positionsTable('Subjects'), completedTable(), belowTable]
      break
    case 'subject':
      subtitle = subjectNames[0]?.[1] ?? null
      sections = [kpis, positionsTable('Students'), completedTable()]
      break
    case 'scores':
      sections = [
        kpis,
        {
          kind: 'table',
          title: 'Average by student',
          columns: [
            { key: 'student', label: 'Student' },
            { key: 'tests', label: 'Tests', align: 'end' },
            { key: 'avg', label: 'Average', align: 'end' },
            { key: 'low', label: 'Lowest', align: 'end' },
            { key: 'high', label: 'Highest', align: 'end' }
          ],
          rows: studentsInScope.map((s) => {
            const mine = scored.filter((r) => r.studentId === s.studentId).map((r) => r.testScore!)
            return {
              student: fullName(s.firstName, s.lastName),
              tests: String(mine.length),
              avg: scoreText(averageScore(mine)),
              low: mine.length ? `${Math.min(...mine)}%` : '—',
              high: mine.length ? `${Math.max(...mine)}%` : '—'
            }
          }),
          empty: 'No students.'
        },
        belowTable,
        completedTable('All test scores')
      ]
      break
    case 'completed':
      sections = [kpis, completedTable()]
      break
    case 'summary':
      sections = [kpis, byStudentTable, positionsTable('Current positions'), belowTable]
      break
  }

  const csvColumns = ['Completed', 'Student', 'Subject', 'PACE', 'Test score', 'Started', 'Notes']
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return {
    type,
    title: info.title,
    subtitle,
    householdName: household.name,
    range,
    periodLabel,
    generatedOn: formatLongDate(today),
    summary,
    sections,
    csv: {
      filename: `${slug(household.name) || 'folio'}-${type}-${range.from}-to-${range.to}.csv`,
      header: csvColumns,
      rows: completed.map((r) => [r.completedOn, fullName(r.firstName, r.lastName), r.subjectName, r.paceNumber, r.testScore, r.startedOn, r.notes])
    }
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
