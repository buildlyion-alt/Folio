import 'server-only'
import { addMonths, formatMonth, periodRange, startOfMonth, type IsoDate } from '@/domain/dates'
import type { HouseholdOverviewDTO } from '@/domain/dto'
import { REPORT_INFO, type ReportType } from '@/server/queries/reports'

/*
 * Report choices live with the report itself: the Reports page is a plain list, and
 * each report opens with sensible defaults that can be changed in place. Server-side
 * only — the client receives the finished option lists.
 */

export interface PeriodOption {
  value: string
  label: string
  params: Record<string, string>
}

export function recentMonths(today: IsoDate, count = 12): string[] {
  const thisMonth = startOfMonth(today)
  return Array.from({ length: count }, (_, i) => addMonths(thisMonth, -i).slice(0, 7))
}

export function periodOptions(type: ReportType, today: IsoDate, schoolYearStart: IsoDate): PeriodOption[] {
  const range = (key: 'week' | 'last_week' | 'year') => {
    const r = periodRange(key, today, schoolYearStart)
    return { from: r.from, to: r.to }
  }
  const month = (m: string): PeriodOption => ({ value: `month:${m}`, label: formatMonth(`${m}-01`), params: { month: m } })
  const months = recentMonths(today)
  if (type === 'weekly') {
    return [
      { value: 'week', label: 'This week', params: range('week') },
      { value: 'last_week', label: 'Last week', params: range('last_week') }
    ]
  }
  if (type === 'monthly') return months.map(month)
  return [{ value: 'year', label: 'School year to date', params: range('year') }, ...months.slice(0, 6).map(month)]
}

/** The option matching the URL, or the report's default when the URL names no period. */
export function currentPeriod(
  type: ReportType,
  params: Record<string, string | undefined>,
  today: IsoDate,
  schoolYearStart: IsoDate
): string | null {
  const options = periodOptions(type, today, schoolYearStart)
  if (params.month) return options.find((o) => o.value === `month:${params.month}`)?.value ?? null
  if (params.from || params.to) return options.find((o) => o.params.from === params.from && o.params.to === params.to)?.value ?? null
  const fallback = REPORT_INFO[type].defaultPeriod
  return fallback === 'month' ? `month:${today.slice(0, 7)}` : fallback
}

/** Where a report opens from the Reports list: a sensible period, and the first child or subject. */
export function defaultReportHref(type: ReportType, overview: HouseholdOverviewDTO): string {
  const params = new URLSearchParams()
  const info = REPORT_INFO[type]
  if (type === 'monthly') {
    // In a month's first week, the month worth reporting on is usually the one that just ended.
    const months = recentMonths(overview.today, 2)
    params.set('month', Number(overview.today.slice(8, 10)) <= 7 ? months[1] : months[0])
  }
  if (info.needs === 'student' && overview.students[0]) params.set('student', overview.students[0].id)
  if (info.needs === 'subject') {
    const enrolled = new Set(overview.students.flatMap((s) => s.enrollments.map((e) => e.subjectId)))
    const subject = overview.subjects.find((s) => enrolled.has(s.id))
    if (subject) params.set('subject', subject.id)
  }
  const query = params.toString()
  return `/reports/${type}${query ? `?${query}` : ''}`
}
