import { and, desc, eq, gte, lte } from 'drizzle-orm'
import {
  defaultSchoolYearStart,
  endOfMonth,
  formatMonth,
  formatRange,
  formatShortDate,
  isIsoDate,
  minDate,
  periodRange,
  startOfMonth,
  type DateRange,
  type PeriodKey
} from '@/domain/dates'
import { listJoin, plural, possessive } from '@/domain/format'
import { formatScore } from '@/domain/pace'
import type { DbExecutor } from '../db/client'
import { paceRecords, studentSubjects, students, subjects, type Household } from '../db/schema'
import { listRecords } from '../queries/records'
import { matchStudent, matchSubject, type ContextStudent, type ContextSubject } from './matching'
import type { AnswerRow, AssistantContext, AssistantResponse, ParsedCommand, ProposedChange, ProviderName } from './types'

const EXAMPLES = [
  'Gabriel completed Math 1084 today with 94% and started 1085',
  'Sarah finished English 1078 yesterday, scored 91',
  'Who completed PACEs this week?',
  'Show scores below 80%',
  'Generate September’s progress summary'
]

interface ResolveOptions {
  db: DbExecutor
  household: Household
  ctx: AssistantContext
  provider: ProviderName
  notice: string | null
}

export async function resolveCommand(parsed: ParsedCommand, options: ResolveOptions): Promise<AssistantResponse> {
  const { provider, notice } = options
  switch (parsed.intent) {
    case 'log_progress':
      return resolveUpdates(parsed, options)
    case 'show_student':
      return resolveShowStudent(parsed, options)
    case 'find_records':
      return resolveFindRecords(parsed, options)
    case 'completed_summary':
      return resolveCompletedSummary(parsed, options)
    case 'report':
      return resolveReport(parsed, options)
    default:
      return {
        type: 'unknown',
        provider,
        notice,
        message: 'I couldn’t find a progress update or a question in that. Try one of these:',
        examples: EXAMPLES
      }
  }
}

// ---------------------------------------------------------------------------
// Progress updates → proposals

async function resolveUpdates(parsed: ParsedCommand, { db, household, ctx, provider, notice }: ResolveOptions): Promise<AssistantResponse> {
  const changes: ProposedChange[] = []
  // Tracks what earlier updates in this same message will do, so "completed 1084 and
  // started the next one" resolves "the next one" to 1085.
  const batchCompleted = new Map<string, number>()
  const seen = new Set<string>()

  for (const [index, update] of parsed.updates.entries()) {
    const change: ProposedChange = {
      key: `change-${index}`,
      studentId: null,
      studentName: update.student || 'Unknown student',
      subjectId: null,
      subjectName: update.subject,
      paceNumber: update.pace,
      status: update.status,
      testScore: update.status === 'completed' ? update.score : null,
      date: update.date,
      notes: update.notes,
      effect: 'create',
      existing: null,
      warnings: [],
      error: null
    }
    changes.push(change)

    const studentMatch = update.student ? matchStudent(ctx, update.student) : ({ error: 'Which student is this for?' } as const)
    if ('error' in studentMatch) {
      change.error = studentMatch.error
      continue
    }
    const student = studentMatch.student
    change.studentId = student.id
    change.studentName = student.firstName

    const subject = resolveSubject(student, update.subject, update.pace, ctx, change)
    if (!subject) continue
    change.subjectId = subject.subjectId
    change.subjectName = subject.subjectName
    const enrollmentKey = `${student.id}:${subject.subjectId}`

    // PACE number: stated, or inferred from where the student is in that subject.
    let pace = update.pace
    if (pace === null) {
      if (update.status === 'active') {
        const after = batchCompleted.get(enrollmentKey) ?? subject.lastCompleted?.paceNumber ?? null
        pace = after !== null ? after + 1 : null
      } else {
        pace = subject.current?.paceNumber ?? null
      }
      if (pace !== null) change.warnings.push(`PACE ${pace} assumed from ${possessive(student.firstName)} current position.`)
    }
    if (pace === null || pace < 1 || pace > 9999) {
      change.error = `Which ${subject.subjectName} PACE? Add the PACE number.`
      continue
    }
    change.paceNumber = pace

    if (update.status !== 'completed' && update.score !== null) {
      change.warnings.push('Score ignored — only completed PACEs have a test score.')
    }
    if (change.testScore !== null && (change.testScore < 0 || change.testScore > 100)) {
      change.error = 'Test scores run from 0 to 100.'
      continue
    }

    const date = update.date ?? ctx.today
    if (!isIsoDate(date)) {
      change.error = 'That date doesn’t look right.'
      continue
    }
    if (date > ctx.today) {
      change.error = `${formatShortDate(date, ctx.today)} is in the future.`
      continue
    }
    change.date = update.status === 'not_started' ? null : date

    const dupeKey = `${enrollmentKey}:${pace}`
    if (seen.has(dupeKey)) {
      change.error = `${subject.subjectName} ${pace} is mentioned twice.`
      continue
    }
    seen.add(dupeKey)

    const [existing] = await db
      .select({ status: paceRecords.status, completedOn: paceRecords.completedOn, testScore: paceRecords.testScore, startedOn: paceRecords.startedOn })
      .from(paceRecords)
      .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
      .where(
        and(
          eq(paceRecords.householdId, household.id),
          eq(studentSubjects.studentId, student.id),
          eq(studentSubjects.subjectId, subject.subjectId),
          eq(paceRecords.paceNumber, pace)
        )
      )
      .limit(1)

    change.existing = existing ? { status: existing.status, completedOn: existing.completedOn, testScore: existing.testScore } : null
    change.effect = effectOf(existing?.status ?? null, update.status)
    if (existing?.status === 'completed' && update.status === 'completed') {
      change.warnings.push(
        `Already completed ${formatShortDate(existing.completedOn!, ctx.today)}${existing.testScore !== null ? ` with ${existing.testScore}%` : ''} — this will replace it.`
      )
    } else if (existing?.status === 'completed') {
      change.warnings.push('This PACE is completed — saving will reopen it and clear its score.')
    } else if (existing && existing.status === update.status && change.effect === 'none') {
      change.warnings.push(`${subject.subjectName} ${pace} is already ${update.status === 'active' ? 'in progress' : 'not started'}.`)
    }
    if (update.status === 'completed' && existing?.startedOn && date < existing.startedOn) {
      change.error = `It was started ${formatShortDate(existing.startedOn, ctx.today)}, so it can’t be completed before then.`
      continue
    }

    if (change.testScore !== null && change.testScore < household.passMark) {
      change.warnings.push(`Below the ${household.passMark}% pass mark — it will show as needing a look.`)
    }
    if (update.status === 'completed' && change.testScore === null) {
      change.warnings.push('No test score mentioned.')
    }
    const reference = subject.current?.paceNumber ?? subject.lastCompleted?.paceNumber ?? null
    if (reference !== null && Math.abs(pace - reference) > 3) {
      change.warnings.push(`${subject.subjectName} is currently around ${reference} — double-check the PACE number.`)
    }

    if (update.status === 'completed') batchCompleted.set(enrollmentKey, pace)
  }

  return {
    type: 'proposals',
    provider,
    notice,
    interpretation: describeChanges(changes),
    changes
  }
}

function resolveSubject(
  student: ContextStudent,
  rawSubject: string | null,
  pace: number | null,
  ctx: AssistantContext,
  change: ProposedChange
): ContextSubject | null {
  const enrolled = student.subjects.map((s) => ({ ...s, name: s.subjectName }))
  if (rawSubject) {
    const match = matchSubject(enrolled, rawSubject)
    if (match) return match
    const householdSubject = matchSubject(ctx.subjects, rawSubject)
    change.error = householdSubject
      ? `${student.firstName} isn’t taking ${householdSubject.name}.`
      : `There’s no subject called “${rawSubject}”.`
    return null
  }
  if (pace !== null) {
    const byPace = enrolled.filter(
      (s) => s.current?.paceNumber === pace || s.lastCompleted?.paceNumber === pace || (s.lastCompleted && s.lastCompleted.paceNumber + 1 === pace)
    )
    if (byPace.length === 1) {
      change.warnings.push(`Matched to ${byPace[0].subjectName}, where ${pace} is the current PACE.`)
      return byPace[0]
    }
  }
  if (enrolled.length === 1) return enrolled[0]
  change.error = `Which subject? ${student.firstName} takes ${listJoin(enrolled.map((s) => s.subjectName))}.`
  return null
}

function effectOf(existing: ProposedChange['status'] | null, next: ProposedChange['status']): ProposedChange['effect'] {
  if (!existing) return next === 'active' ? 'start' : next === 'completed' ? 'create' : 'reset'
  if (existing === 'completed') return next === 'completed' ? 'update' : 'reopen'
  if (next === 'completed') return 'complete'
  if (existing === next) return 'none'
  return next === 'active' ? 'start' : 'reset'
}

function describeChanges(changes: ProposedChange[]): string {
  const valid = changes.filter((c) => !c.error)
  if (valid.length === 0) return 'I couldn’t turn that into a record yet.'
  return valid
    .map((c) => {
      const verb = c.status === 'completed' ? 'completed' : c.status === 'active' ? 'started' : 'reset'
      const score = c.testScore !== null ? ` with ${c.testScore}%` : ''
      return `${c.studentName} ${verb} ${c.subjectName} ${c.paceNumber}${score}`
    })
    .join('; ')
}

// ---------------------------------------------------------------------------
// Questions → answers / navigation

function rangeFor(parsed: ParsedCommand, household: Household, today: string): DateRange | null {
  const yearStart = household.schoolYearStart ?? defaultSchoolYearStart(today)
  if (parsed.month && /^\d{4}-\d{2}$/.test(parsed.month)) {
    const from = `${parsed.month}-01`
    return { from, to: minDate(endOfMonth(from), today) }
  }
  const map: Record<NonNullable<ParsedCommand['period']>, PeriodKey | 'today'> = {
    today: 'today',
    this_week: 'week',
    last_week: 'last_week',
    this_month: 'month',
    last_month: 'last_month',
    this_year: 'year'
  }
  if (!parsed.period) return null
  const key = map[parsed.period]
  if (key === 'today') return { from: today, to: today }
  return periodRange(key, today, yearStart)
}

function resolveStudentOrNull(ctx: AssistantContext, name: string | null): ContextStudent | null {
  if (!name) return null
  const match = matchStudent(ctx, name)
  return 'student' in match ? match.student : null
}

function resolveShowStudent(parsed: ParsedCommand, { ctx, provider, notice }: ResolveOptions): AssistantResponse {
  const student = resolveStudentOrNull(ctx, parsed.student)
  if (!student) {
    return {
      type: 'unknown',
      provider,
      notice,
      message: parsed.student ? `There’s no student named “${parsed.student}”.` : 'Which student would you like to see?',
      examples: ctx.students.slice(0, 3).map((s) => `Show me ${possessive(s.firstName)} progress`)
    }
  }
  const subject = parsed.subject ? matchSubject(student.subjects.map((s) => ({ ...s, name: s.subjectName })), parsed.subject) : null
  const href = subject ? `/students/${student.id}?subject=${subject.subjectId}` : `/students/${student.id}`
  return {
    type: 'navigate',
    provider,
    notice,
    href,
    title: subject ? `${possessive(student.firstName)} ${subject.subjectName} progress` : `${possessive(student.firstName)} profile`
  }
}

async function resolveFindRecords(parsed: ParsedCommand, { db, household, ctx, provider, notice }: ResolveOptions): Promise<AssistantResponse> {
  const student = resolveStudentOrNull(ctx, parsed.student)
  const subject = parsed.subject ? matchSubject(ctx.subjects, parsed.subject) : null
  const range = rangeFor(parsed, household, ctx.today)
  const filters = {
    student: student?.id,
    subject: subject?.id,
    status: parsed.filters.scoreMax !== null || parsed.filters.scoreMin !== null ? ('completed' as const) : (parsed.filters.status ?? undefined),
    scoreMin: parsed.filters.scoreMin ?? undefined,
    scoreMax: parsed.filters.scoreMax ?? undefined,
    paceMin: parsed.filters.pace ?? undefined,
    paceMax: parsed.filters.pace ?? undefined,
    from: range?.from,
    to: range?.to
  }
  const { rows, total } = await listRecords(db, household.id, { ...filters, sort: 'date', dir: 'desc' }, { pageSize: 8 })
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value !== undefined) params.set(key, String(value))

  const titleParts: string[] = []
  if (filters.scoreMax !== undefined) titleParts.push(`Scores below ${filters.scoreMax + 1}%`)
  else if (filters.scoreMin !== undefined) titleParts.push(`Scores of ${filters.scoreMin}% and up`)
  else titleParts.push('Records')
  if (student) titleParts.push(`for ${student.firstName}`)
  if (subject) titleParts.push(`in ${subject.name}`)
  if (range) titleParts.push(`· ${formatRange(range, ctx.today)}`)

  return {
    type: 'answer',
    provider,
    notice,
    title: titleParts.join(' '),
    summary: total === 0 ? 'No records match.' : `${plural(total, 'record')} ${total === 1 ? 'matches' : 'match'}.`,
    rows: rows.map((r) => ({
      primary: `${r.studentName} · ${r.subjectName} ${r.paceNumber}`,
      secondary: r.completedOn ? `Completed ${formatShortDate(r.completedOn, ctx.today)}` : r.status === 'active' ? 'In progress' : 'Not started',
      value: formatScore(r.testScore),
      href: `/students/${r.studentId}?record=${r.id}`,
      tone: r.testScore !== null && r.testScore < household.passMark ? 'danger' : 'neutral'
    })),
    link: { href: `/records?${params.toString()}`, label: total > rows.length ? `View all ${total} in Records` : 'Open in Records' }
  }
}

async function resolveCompletedSummary(parsed: ParsedCommand, { db, household, ctx, provider, notice }: ResolveOptions): Promise<AssistantResponse> {
  const range = rangeFor(parsed, household, ctx.today) ?? periodRange('week', ctx.today, household.schoolYearStart ?? defaultSchoolYearStart(ctx.today))
  const student = resolveStudentOrNull(ctx, parsed.student)
  const conditions = [
    eq(paceRecords.householdId, household.id),
    eq(paceRecords.status, 'completed'),
    gte(paceRecords.completedOn, range.from),
    lte(paceRecords.completedOn, range.to)
  ]
  if (student) conditions.push(eq(studentSubjects.studentId, student.id))
  const rows = await db
    .select({
      studentId: students.id,
      firstName: students.firstName,
      subjectName: subjects.name,
      paceNumber: paceRecords.paceNumber,
      testScore: paceRecords.testScore,
      completedOn: paceRecords.completedOn
    })
    .from(paceRecords)
    .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(and(...conditions))
    .orderBy(desc(paceRecords.completedOn))

  const byStudent = new Map<string, { name: string; items: typeof rows }>()
  for (const row of rows) {
    const entry = byStudent.get(row.studentId) ?? { name: row.firstName, items: [] }
    entry.items.push(row)
    byStudent.set(row.studentId, entry)
  }
  const periodLabel = describePeriod(parsed, range)
  const answerRows: AnswerRow[] = [...byStudent.entries()]
    .sort((a, b) => b[1].items.length - a[1].items.length)
    .map(([studentId, entry]) => ({
      primary: entry.name,
      secondary: entry.items.map((i) => `${i.subjectName} ${i.paceNumber}${i.testScore !== null ? ` (${i.testScore}%)` : ''}`).join(', '),
      value: String(entry.items.length),
      href: `/students/${studentId}`
    }))
  const params = new URLSearchParams({ status: 'completed', from: range.from, to: range.to })
  if (student) params.set('student', student.id)

  return {
    type: 'answer',
    provider,
    notice,
    title: `Completed ${periodLabel}`,
    summary:
      rows.length === 0
        ? `No PACEs completed ${periodLabel} yet.`
        : `${plural(rows.length, 'PACE')} completed ${periodLabel} by ${plural(byStudent.size, 'student')}.`,
    rows: answerRows,
    link: rows.length ? { href: `/records?${params.toString()}`, label: 'Open in Records' } : null
  }
}

function describePeriod(parsed: ParsedCommand, range: DateRange): string {
  if (parsed.month) return `in ${formatMonth(range.from)}`
  switch (parsed.period) {
    case 'today':
      return 'today'
    case 'last_week':
      return 'last week'
    case 'this_month':
      return 'this month'
    case 'last_month':
      return 'last month'
    case 'this_year':
      return 'this school year'
    default:
      return 'this week'
  }
}

function resolveReport(parsed: ParsedCommand, { household, ctx, provider, notice }: ResolveOptions): AssistantResponse {
  const student = resolveStudentOrNull(ctx, parsed.student)
  let range = rangeFor(parsed, household, ctx.today)
  let type = parsed.reportType ?? 'summary'
  if (!range) {
    range =
      type === 'weekly'
        ? periodRange('week', ctx.today, household.schoolYearStart ?? defaultSchoolYearStart(ctx.today))
        : type === 'monthly'
          ? { from: startOfMonth(ctx.today), to: ctx.today }
          : { from: household.schoolYearStart ?? defaultSchoolYearStart(ctx.today), to: ctx.today }
  }
  if (student && (type === 'summary' || type === 'student')) type = 'student'
  const params = new URLSearchParams({ from: range.from, to: range.to })
  if (student) params.set('student', student.id)
  const label = parsed.month
    ? new Date(`${parsed.month}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : formatRange(range, ctx.today)
  return {
    type: 'navigate',
    provider,
    notice,
    href: `/reports/${type}?${params.toString()}`,
    title: `${student ? `${possessive(student.firstName)} ` : ''}progress report · ${label}`
  }
}
