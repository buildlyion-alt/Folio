/**
 * Calendar-date helpers. Academic events (a PACE started or completed) happen on a
 * *day*, not at an instant, so Folio stores them as ISO date strings ('YYYY-MM-DD')
 * and does all arithmetic in UTC to stay immune to DST shifts. "Today" is always
 * resolved in the household's own time zone.
 */

export type IsoDate = string

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function toUtc(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

/** Today's date in an IANA time zone, e.g. todayIn('America/Chicago') → '2026-10-02'. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now)
  } catch {
    return fromUtc(now)
  }
}

/** Hour of day (0–23) in a time zone — used for the dashboard greeting. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23'
    }).format(now)
    return Number(hour) % 24
  } catch {
    return now.getUTCHours()
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS))
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS)
}

/** Monday of the week containing `date` (ISO weeks start on Monday). */
export function startOfWeek(date: IsoDate): IsoDate {
  const weekday = toUtc(date).getUTCDay() // 0 = Sunday
  const offset = (weekday + 6) % 7
  return addDays(date, -offset)
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: IsoDate): IsoDate {
  const [y, m] = date.split('-').map(Number)
  return fromUtc(new Date(Date.UTC(y, m, 0)))
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return fromUtc(target)
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b
}

function parts(date: IsoDate): { y: number; m: number; d: number; weekday: number } {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m, d, weekday: toUtc(date).getUTCDay() }
}

/** "Oct 3" or "Oct 3, 2025" when not in the reference year. */
export function formatShortDate(date: IsoDate, today?: IsoDate): string {
  const { y, m, d } = parts(date)
  const base = `${MONTHS_SHORT[m - 1]} ${d}`
  if (today && today.slice(0, 4) !== String(y)) return `${base}, ${y}`
  return base
}

/** "October 3, 2026" */
export function formatLongDate(date: IsoDate): string {
  const { y, m, d } = parts(date)
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`
}

/** "Friday, October 2" */
export function formatWeekdayDate(date: IsoDate): string {
  const { m, d, weekday } = parts(date)
  return `${WEEKDAYS[weekday]}, ${MONTHS_LONG[m - 1]} ${d}`
}

/** "September 2026" */
export function formatMonth(date: IsoDate): string {
  const { y, m } = parts(date)
  return `${MONTHS_LONG[m - 1]} ${y}`
}

export function monthName(month: number): string {
  return MONTHS_LONG[month - 1]
}

export function monthIndexFromName(name: string): number | null {
  const lower = name.toLowerCase()
  const index = MONTHS_LONG.findIndex(
    (month) => month.toLowerCase() === lower || month.slice(0, 3).toLowerCase() === lower
  )
  if (index === -1 && lower === 'sept') return 9
  return index === -1 ? null : index + 1
}

export function weekdayIndexFromName(name: string): number | null {
  const lower = name.toLowerCase()
  const index = WEEKDAYS.findIndex(
    (day) => day.toLowerCase() === lower || day.slice(0, 3).toLowerCase() === lower
  )
  return index === -1 ? null : index
}

/** "Today", "Yesterday", "3 days ago", then a short date. */
export function formatRelativeDay(date: IsoDate, today: IsoDate): string {
  const days = diffDays(date, today)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return `${days} days ago`
  if (days === -1) return 'Tomorrow'
  return formatShortDate(date, today)
}

export function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Fallback school-year start when a household hasn't set one: August 1 of the
 * current academic year (A.C.E. families in the northern hemisphere mostly start
 * in August/September). Editable in Settings.
 */
export function defaultSchoolYearStart(today: IsoDate): IsoDate {
  const { y, m } = parts(today)
  return m >= 8 ? `${y}-08-01` : `${y - 1}-08-01`
}

export interface DateRange {
  from: IsoDate
  to: IsoDate
}

export type PeriodKey = 'week' | 'last_week' | 'month' | 'last_month' | 'year'

export function periodRange(
  period: PeriodKey,
  today: IsoDate,
  schoolYearStart: IsoDate
): DateRange {
  switch (period) {
    case 'week':
      return { from: startOfWeek(today), to: today }
    case 'last_week': {
      const thisWeek = startOfWeek(today)
      return { from: addDays(thisWeek, -7), to: addDays(thisWeek, -1) }
    }
    case 'month':
      return { from: startOfMonth(today), to: today }
    case 'last_month': {
      const lastMonth = addMonths(startOfMonth(today), -1)
      return { from: lastMonth, to: endOfMonth(lastMonth) }
    }
    case 'year':
      return { from: schoolYearStart, to: today }
  }
}

/** "Sep 1 – Sep 30", adding years only when the range isn't in the reference year. */
export function formatRange(range: DateRange, today?: IsoDate): string {
  if (range.from === range.to) return formatShortDate(range.from, today)
  const fromYear = range.from.slice(0, 4)
  const toYear = range.to.slice(0, 4)
  const currentYear = today?.slice(0, 4)
  if (fromYear === toYear) {
    const suffix = currentYear && currentYear !== toYear ? `, ${toYear}` : ''
    return `${formatShortDate(range.from)} – ${formatShortDate(range.to)}${suffix}`
  }
  return `${formatShortDate(range.from)}, ${fromYear} – ${formatShortDate(range.to)}, ${toYear}`
}
