import { addDays, fromUtc, toUtc, type IsoDate } from '@/domain/dates'
import {
  findStudentMentions,
  findSubjectMentions,
  guessUnknownName,
  normalizeText,
  type ContextStudent
} from './matching'
import type { AssistantContext, ParsedCommand, ParsedUpdate } from './types'

/*
 * Deterministic parser for progress statements and questions. Runs whenever no AI
 * provider is configured (or the provider fails), so natural-language entry keeps
 * working offline. It extracts only what the text says; the resolver then checks
 * everything against real records before anything is proposed.
 */

const MONTH_PATTERN =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const WEEKDAY_ABBR = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

type Status = ParsedUpdate['status']

const STATUS_PATTERNS: Array<[RegExp, Status]> = [
  [/\b(?:not started|hasn'?t started|reset|un-?started|cleared)\b/, 'not_started'],
  [
    /\b(?:complet(?:e|ed|es|ing)|finish(?:ed|es|ing)?|done|pass(?:ed|es)?|scor(?:e|ed|es|ing)|got|gets|earned|tested|took (?:the|his|her|their) (?:pace )?test|fail(?:ed|s)?)\b/,
    'completed'
  ],
  [
    /\b(?:start(?:s|ed|ing)?|beg[ai]n(?:s|ning)?|begun|moved? (?:on )?(?:to|onto)|moving (?:on )?to|now on|working on|onto|picked up)\b/,
    'active'
  ]
]
const LOG_VERB = /\b(?:log|logged|record(?:ed)?|mark(?:ed)?|enter(?:ed)?|add(?:ed)?|put down)\b/
const SCORE_CUE = /(?:scor(?:e|ed|es|ing)(?: of)?|got(?: a| an)?|with(?: a| an)?|at|earn(?:ed)?(?: a| an)?|made(?: a| an)?|received(?: a| an)?|mark(?: of)?|of)\s*$/
const PACE_CUE = /(?:pace|paces|#|no\.?|number)\s*$/

function monthIndex(token: string): number {
  return MONTH_KEYS.indexOf(token.slice(0, 3))
}

/** Most recent occurrence of month/day on or before today. */
function pastDate(month: number, day: number, year: number | null, today: IsoDate): IsoDate | null {
  const currentYear = Number(today.slice(0, 4))
  const build = (y: number) => {
    const date = new Date(Date.UTC(y, month, day))
    return date.getUTCMonth() === month ? fromUtc(date) : null
  }
  if (year !== null) return build(year < 100 ? 2000 + year : year)
  const candidate = build(currentYear)
  if (candidate && candidate <= today) return candidate
  return build(currentYear - 1)
}

function weekdayDate(index: number, modifier: string | undefined, today: IsoDate): IsoDate {
  const todayIndex = toUtc(today).getUTCDay()
  let back = (todayIndex - index + 7) % 7
  if (modifier === 'last' && back === 0) back = 7
  return addDays(today, -back)
}

/** Day-first in most of the world, month-first in the Americas. */
function monthFirst(timezone: string): boolean {
  return timezone.startsWith('America/') || timezone.startsWith('US/') || timezone === 'Pacific/Honolulu'
}

export function extractDate(segment: string, ctx: AssistantContext): { date: IsoDate | null; rest: string } {
  const { today } = ctx
  const take = (match: RegExpExecArray, date: IsoDate | null) => ({
    date,
    rest: `${segment.slice(0, match.index)} ${segment.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim()
  })

  let match = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(segment)
  if (match) {
    const date = `${match[1]}-${match[2]}-${match[3]}`
    return take(match, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null)
  }
  match = new RegExp(`\\b(?:on\\s+)?(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`).exec(segment)
  if (match) return take(match, pastDate(monthIndex(match[1]), Number(match[2]), match[3] ? Number(match[3]) : null, today))
  match = new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_PATTERN})\\b(?:\\s+(\\d{4}))?`).exec(segment)
  if (match) return take(match, pastDate(monthIndex(match[2]), Number(match[1]), match[3] ? Number(match[3]) : null, today))
  match = /\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(segment)
  if (match) {
    const [a, b] = [Number(match[1]), Number(match[2])]
    const [month, day] = monthFirst(ctx.timezone) ? [a, b] : [b, a]
    return take(match, month >= 1 && month <= 12 ? pastDate(month - 1, day, match[3] ? Number(match[3]) : null, today) : null)
  }
  match = /\b(?:today|tonight|this morning|this afternoon|this evening)\b/.exec(segment)
  if (match) return take(match, today)
  match = /\byesterday\b/.exec(segment)
  if (match) return take(match, addDays(today, -1))
  match = new RegExp(`\\b(?:on\\s+)?(?:(last|this|past)\\s+)?(${WEEKDAYS.join('|')})\\b`).exec(segment)
  if (match) return take(match, weekdayDate(WEEKDAYS.indexOf(match[2]), match[1], today))
  match = new RegExp(`\\bon\\s+(${WEEKDAY_ABBR.join('|')})\\b`).exec(segment)
  if (match) return take(match, weekdayDate(WEEKDAY_ABBR.indexOf(match[1]), undefined, today))
  return { date: null, rest: segment }
}

function detectStatus(segment: string): Status | null {
  let best: { status: Status; index: number } | null = null
  for (const [pattern, status] of STATUS_PATTERNS) {
    const match = pattern.exec(segment)
    if (match && (!best || match.index < best.index)) best = { status, index: match.index }
  }
  return best?.status ?? null
}

function extractNumbers(segment: string): { paces: number[]; score: number | null } {
  const paces: number[] = []
  let score: number | null = null
  const pattern = /(\d{1,4})\s*(%|percent\b|pct\b)?/g
  for (const match of segment.matchAll(pattern)) {
    const value = Number(match[1])
    const before = segment.slice(Math.max(0, match.index! - 16), match.index!)
    const isPercent = Boolean(match[2])
    if (isPercent) {
      if (value <= 100 && score === null) score = value
    } else if (PACE_CUE.test(before)) {
      paces.push(value)
    } else if (SCORE_CUE.test(before) && value <= 100) {
      if (score === null) score = value
      else paces.push(value)
    } else if (value > 100) {
      paces.push(value)
    } else if (paces.length > 0 && score === null) {
      score = value
    } else if (score === null && value <= 100 && paces.length === 0) {
      // A bare small number with nothing else: most likely a score ("Gabriel math 94").
      score = value
    } else {
      paces.push(value)
    }
  }
  return { paces, score }
}

export function parseScoreFilter(text: string, passMark: number): { scoreMin: number | null; scoreMax: number | null } | null {
  let match = /\b(?:below|under|less than|lower than|beneath)\s+(\d{1,3})\s*%?/.exec(text)
  if (match) return { scoreMin: null, scoreMax: Math.max(0, Number(match[1]) - 1) }
  match = /\b(?:at most|no more than|at or below)\s+(\d{1,3})\s*%?/.exec(text)
  if (match) return { scoreMin: null, scoreMax: Number(match[1]) }
  match = /\b(?:above|over|more than|greater than|higher than)\s+(\d{1,3})\s*%?/.exec(text)
  if (match) return { scoreMin: Math.min(100, Number(match[1]) + 1), scoreMax: null }
  match = /\b(?:at least|no less than|at or above)\s+(\d{1,3})\s*%?/.exec(text)
  if (match) return { scoreMin: Number(match[1]), scoreMax: null }
  if (/\b(?:failing|failed|fails|low scores?|below (?:the )?pass(?:ing)? mark)\b/.test(text)) return { scoreMin: null, scoreMax: passMark - 1 }
  return null
}

function detectPeriod(text: string): ParsedCommand['period'] {
  if (/\btoday\b/.test(text)) return 'today'
  if (/\b(?:this|current) week\b/.test(text)) return 'this_week'
  if (/\b(?:last|previous|past) week\b/.test(text)) return 'last_week'
  if (/\b(?:this|current) month\b/.test(text)) return 'this_month'
  if (/\b(?:last|previous|past) month\b/.test(text)) return 'last_month'
  if (/\b(?:this|current) (?:school )?year\b/.test(text)) return 'this_year'
  return null
}

function detectMonth(text: string, today: IsoDate): string | null {
  const match = /\b(january|february|march|april|may|june|july|august|september|october|november|december|sept)\b/.exec(text)
  if (!match) return null
  const month = monthIndex(match[1]) + 1
  const year = Number(today.slice(0, 4))
  const currentMonth = Number(today.slice(5, 7))
  const y = month > currentMonth ? year - 1 : year
  return `${y}-${String(month).padStart(2, '0')}`
}

const EMPTY_FILTERS = { scoreMin: null, scoreMax: null, status: null, pace: null }

function base(intent: ParsedCommand['intent']): ParsedCommand {
  return { intent, updates: [], student: null, subject: null, filters: { ...EMPTY_FILTERS }, period: null, month: null, reportType: null }
}

const QUESTION_LEAD = /^(?:who|what|which|how|when|where|show|find|list|view|open|see|display|look|pull up|search|give me|can you show|please show)\b/

export function parseOffline(input: string, ctx: AssistantContext): ParsedCommand {
  const original = input.trim()
  const noteMatch = /\bnotes?\s*:\s*(.+)$/i.exec(original)
  const notes = noteMatch ? noteMatch[1].trim() : null
  const text = normalizeText(noteMatch ? original.slice(0, noteMatch.index) : original)
  if (!text) return base('unknown')

  const students = findStudentMentions(ctx, text)
  const subjects = findSubjectMentions(ctx.subjects, text)
  const firstStudent = students[0]?.item.firstName ?? null
  const firstSubject = subjects[0]?.item.name ?? null
  const scoreFilter = parseScoreFilter(text, ctx.passMark)
  const isQuestion = QUESTION_LEAD.test(text) || text.endsWith('?')
  const status = detectStatus(text)
  const hasPaceLikeNumber = /\b\d{3,4}\b/.test(text)

  // Reports: "Generate September's progress summary", "weekly report for Gabriel".
  if (/\b(?:report|summary|summari[sz]e|recap)\b/.test(text) && !(status && hasPaceLikeNumber && !isQuestion)) {
    const command = base('report')
    command.student = firstStudent
    command.subject = firstSubject
    command.period = detectPeriod(text)
    command.month = detectMonth(text, ctx.today)
    command.reportType = /\bweek/.test(text)
      ? 'weekly'
      : command.month || /\bmonth/.test(text)
        ? 'monthly'
        : /\bscores?\b|\btests?\b/.test(text)
          ? 'scores'
          : command.student
            ? 'student'
            : command.subject
              ? 'subject'
              : 'summary'
    return command
  }

  // "Who completed PACEs this week?"
  if (/^(?:who|which|how many|what)\b/.test(text) && /\b(?:complet|finish|done|pass)/.test(text)) {
    const command = base('completed_summary')
    command.student = firstStudent
    command.subject = firstSubject
    command.period = detectPeriod(text) ?? 'this_week'
    return command
  }

  // "Show scores below 80%", "find Joshua's science records"
  if (scoreFilter || (isQuestion && /\b(?:records?|scores?|results?|history|tests?)\b/.test(text))) {
    const command = base('find_records')
    command.student = firstStudent
    command.subject = firstSubject
    command.filters = { ...EMPTY_FILTERS, ...(scoreFilter ?? {}) }
    command.period = detectPeriod(text)
    const pace = /\b(\d{3,4})\b/.exec(text)
    if (pace && !scoreFilter) command.filters.pace = Number(pace[1])
    return command
  }

  // "Show me Sarah's Science progress", "How is Joshua doing?"
  if (isQuestion && !(status && hasPaceLikeNumber)) {
    if (firstStudent) {
      const command = base('show_student')
      command.student = firstStudent
      command.subject = firstSubject
      return command
    }
    if (firstSubject) {
      const command = base('find_records')
      command.subject = firstSubject
      return command
    }
    return base('unknown')
  }

  const looksLikeLog = Boolean(status) || LOG_VERB.test(text) || (students.length > 0 && /\d/.test(text))
  if (!looksLikeLog) return base('unknown')

  const command = base('log_progress')
  command.updates = parseUpdates(text, ctx, original)
  if (notes && command.updates.length) command.updates[command.updates.length - 1].notes = notes
  if (command.updates.length === 0) return base('unknown')
  return command
}

interface Draft extends ParsedUpdate {
  explicitDate: boolean
}

function parseUpdates(text: string, ctx: AssistantContext, original: string): ParsedUpdate[] {
  // Keep "Oct 3, 2026" in one piece before splitting on commas.
  const protectedText = text.replace(new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,\\s*(\\d{4})`, 'g'), '$1 $2 $3')
  const segments = protectedText
    .split(/\s*(?:[.;!?\n]+(?:\s|$)|,\s*(?:and|then|also|plus)\b|\b(?:and then|and also|and|then|also|plus|but)\b|,)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

  const drafts: Draft[] = []
  let previous: Draft | null = null
  let pending: ContextStudent[] = []
  const unknownName = guessUnknownName(original)
  const soleStudent = ctx.students.length === 1 ? ctx.students[0] : null

  for (const raw of segments) {
    const { date, rest } = extractDate(raw, ctx)
    const studentMentions = findStudentMentions(ctx, rest).map((m) => m.item)
    // Remove names before reading numbers and subjects, so "Sarah's" can't be misread.
    let remainder = rest
    for (const mention of findStudentMentions(ctx, rest).sort((a, b) => b.index - a.index)) {
      remainder = `${remainder.slice(0, mention.index)} ${remainder.slice(mention.index + mention.length)}`
    }
    const subject = findSubjectMentions(ctx.subjects, remainder)[0]?.item ?? null
    const status = detectStatus(remainder)
    const isLog = LOG_VERB.test(remainder)
    const { paces, score } = extractNumbers(remainder)
    const hasCore = paces.length > 0 || subject !== null || status !== null || isLog

    if (!hasCore && studentMentions.length > 0 && score === null) {
      pending.push(...studentMentions)
      continue
    }
    // "…finished English 1078, scored 91": a bare score completes the update before it.
    const bareScore =
      score !== null && paces.length === 0 && subject === null && studentMentions.length === 0 && (status === null || status === 'completed')
    if (bareScore && previous && previous.status === 'completed' && previous.score === null) {
      previous.score = score
      if (date && !previous.explicitDate) {
        previous.date = date
        previous.explicitDate = true
      }
      continue
    }
    if (!hasCore && studentMentions.length === 0) {
      if (previous) {
        if (score !== null && previous.score === null) previous.score = score
        if (date && !previous.explicitDate) {
          previous.date = date
          previous.explicitDate = true
        }
      }
      continue
    }

    const who: Array<ContextStudent | null> = studentMentions.length
      ? [...pending, ...studentMentions]
      : pending.length
        ? pending
        : previous
          ? [ctx.students.find((s) => s.firstName === previous!.student) ?? null]
          : [soleStudent]
    pending = []

    const continuing = previous && studentMentions.length === 0
    const resolvedStatus: Status =
      status ?? (score !== null ? 'completed' : continuing && previous ? previous.status : isLog ? 'completed' : 'active')

    for (const student of who) {
      for (const pace of paces.length ? paces : [null]) {
        const draft: Draft = {
          student: student?.firstName ?? unknownName ?? '',
          subject: subject?.name ?? (continuing ? (previous?.subject ?? null) : null),
          pace,
          status: resolvedStatus,
          score: resolvedStatus === 'completed' ? score : null,
          date: date ?? (continuing ? (previous?.date ?? null) : null),
          notes: null,
          explicitDate: Boolean(date)
        }
        drafts.push(draft)
        previous = draft
      }
    }
  }

  return drafts.map(({ explicitDate: _explicit, ...update }) => update)
}
