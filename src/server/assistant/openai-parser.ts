import 'server-only'
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { formatWeekdayDate } from '@/domain/dates'
import { parsedCommandSchema, type AssistantContext, type ParsedCommand } from './types'

/*
 * OpenAI-backed parsing. Server-only: the API key never reaches the browser.
 *
 * Data minimization: the model sees the parent's sentence, today's date, and the
 * household's student first names and subject names — nothing else. No scores, no
 * records, no history. Its output is a proposal that the resolver validates against
 * the database and the parent must confirm.
 */

export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'

export function openAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export function openAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
}

function instructions(ctx: AssistantContext): string {
  const roster = ctx.students
    .map((s) => {
      const name = s.lastName ? `${s.firstName} ${s.lastName}` : s.firstName
      const subjects = s.subjects.map((sub) => sub.subjectName).join(', ') || 'no subjects'
      return `- ${name}: ${subjects}`
    })
    .join('\n')

  return [
    'You turn a homeschool parent’s short message into a structured command for Folio, an A.C.E. (Accelerated Christian Education) record-keeping app.',
    'A.C.E. students work through numbered workbooks called PACEs (usually 1001–1144). Each PACE ends with a PACE Test scored as a percentage.',
    `Today is ${formatWeekdayDate(ctx.today)} (${ctx.today}). Resolve relative dates ("today", "yesterday", "on Monday") to YYYY-MM-DD, never in the future.`,
    'Students and the subjects they take:',
    roster,
    '',
    'Rules:',
    '- Extract only what the message states. Never invent PACE numbers, scores, dates or students. Use null for anything not stated.',
    '- One entry in `updates` per PACE mentioned, in order. "Completed 1084 and started 1085" is two updates; the second inherits the student and subject.',
    '- completed = finished / passed / scored / got N% on. active = started / began / moved on to / is now on. not_started = reset.',
    '- A percentage or "scored N" is the test score. Four-digit numbers are PACE numbers.',
    '- Use intent log_progress only when the parent is reporting progress to record. Questions use show_student, find_records, completed_summary or report.',
    '- For "below 80%" set filters.scoreMax to 79; for "above 90%" set filters.scoreMin to 91.',
    '- Write student and subject names as the parent wrote them; the app matches them to records itself.'
  ].join('\n')
}

export async function parseWithOpenAI(text: string, ctx: AssistantContext): Promise<ParsedCommand> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15_000, maxRetries: 1 })
  const response = await client.responses.parse({
    model: openAiModel(),
    instructions: instructions(ctx),
    input: text,
    text: { format: zodTextFormat(parsedCommandSchema, 'folio_command') }
  })
  const parsed = response.output_parsed
  if (!parsed) throw new Error('The model did not return a structured command.')
  // Validate again — structured outputs constrain shape, not trustworthiness.
  return parsedCommandSchema.parse(parsed)
}
