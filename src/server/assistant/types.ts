import * as z from 'zod'

/*
 * The assistant's intermediate representation. Both providers — OpenAI and the offline
 * parser — produce exactly this shape from free text. It contains only what the parent
 * said (names as written, numbers, dates); resolving names to records happens afterwards,
 * against the household's real data, and nothing is written until the parent confirms.
 *
 * Every field is required-but-nullable so the schema works with OpenAI strict
 * structured outputs.
 */

export const parsedUpdateSchema = z.object({
  student: z.string().describe('The student name exactly as the parent wrote it.'),
  subject: z
    .string()
    .nullable()
    .describe('The subject as written (e.g. "Math"), or null if not mentioned.'),
  pace: z.number().int().nullable().describe('The PACE number, or null if not mentioned.'),
  status: z
    .enum(['completed', 'active', 'not_started'])
    .describe('completed = finished/passed/scored; active = started/began/moved on to; not_started = reset.'),
  score: z
    .number()
    .int()
    .nullable()
    .describe('PACE Test score as a whole-number percentage, or null if not mentioned.'),
  date: z
    .string()
    .nullable()
    .describe('ISO date YYYY-MM-DD the event happened, resolved from words like "today"; null if not mentioned.'),
  notes: z.string().nullable().describe('Only an explicit note the parent asked to record, else null.')
})

export const parsedCommandSchema = z.object({
  intent: z
    .enum(['log_progress', 'show_student', 'find_records', 'completed_summary', 'report', 'unknown'])
    .describe(
      'log_progress: the parent reports progress to record. show_student: view a student (optionally a subject). find_records: look up records, e.g. low scores. completed_summary: who completed what in a period. report: generate a progress report/summary.'
    ),
  updates: z.array(parsedUpdateSchema).describe('Progress updates to record, in the order mentioned. Empty unless intent is log_progress.'),
  student: z.string().nullable().describe('Student the question or report is about, if any.'),
  subject: z.string().nullable().describe('Subject the question or report is about, if any.'),
  filters: z.object({
    scoreMin: z.number().int().nullable(),
    scoreMax: z.number().int().nullable().describe('For "below 80%" use 79.'),
    status: z.enum(['completed', 'active', 'not_started']).nullable(),
    pace: z.number().int().nullable()
  }),
  period: z
    .enum(['today', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year'])
    .nullable()
    .describe('Time period mentioned, if any.'),
  month: z.string().nullable().describe('A specific month mentioned, as YYYY-MM (e.g. "September" → the most recent September).'),
  reportType: z
    .enum(['weekly', 'monthly', 'student', 'subject', 'scores', 'completed', 'summary'])
    .nullable()
    .describe('Kind of report requested, if intent is report.')
})

export type ParsedUpdate = z.infer<typeof parsedUpdateSchema>
export type ParsedCommand = z.infer<typeof parsedCommandSchema>

export type ProviderName = 'openai' | 'offline'

/** A change the assistant proposes. Only becomes a record after the parent confirms it. */
export interface ProposedChange {
  key: string
  studentId: string | null
  studentName: string
  subjectId: string | null
  subjectName: string | null
  paceNumber: number | null
  status: 'completed' | 'active' | 'not_started'
  testScore: number | null
  date: string | null
  notes: string | null
  /** What saving would do to the existing record, for the confirmation copy. */
  effect: 'create' | 'complete' | 'update' | 'reopen' | 'start' | 'reset' | 'none'
  existing: { status: 'not_started' | 'active' | 'completed'; completedOn: string | null; testScore: number | null } | null
  warnings: string[]
  /** Set when the change can't be applied as understood (unknown student, missing PACE…). */
  error: string | null
}

export interface AnswerRow {
  primary: string
  secondary?: string
  value?: string
  href?: string
  tone?: 'neutral' | 'signal' | 'danger'
}

export type AssistantResponse =
  | {
      type: 'proposals'
      provider: ProviderName
      notice: string | null
      interpretation: string
      changes: ProposedChange[]
    }
  | {
      type: 'answer'
      provider: ProviderName
      notice: string | null
      title: string
      summary: string
      rows: AnswerRow[]
      link: { href: string; label: string } | null
    }
  | {
      type: 'navigate'
      provider: ProviderName
      notice: string | null
      href: string
      title: string
    }
  | {
      type: 'unknown'
      provider: ProviderName
      notice: string | null
      message: string
      examples: string[]
    }

/** What the parser is told about the household. Names only — no scores or history. */
export interface AssistantContext {
  today: string
  timezone: string
  passMark: number
  students: Array<{
    id: string
    firstName: string
    lastName: string | null
    subjects: Array<{
      subjectId: string
      subjectName: string
      current: { recordId: string; paceNumber: number } | null
      lastCompleted: { paceNumber: number; completedOn: string; testScore: number | null } | null
    }>
  }>
  subjects: Array<{ id: string; name: string }>
}
