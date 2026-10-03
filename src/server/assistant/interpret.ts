import 'server-only'
import { todayIn } from '@/domain/dates'
import type { HouseholdOverviewDTO } from '@/domain/dto'
import type { DbExecutor } from '../db/client'
import type { Household } from '../db/schema'
import { parseOffline } from './offline-parser'
import { openAiConfigured, parseWithOpenAI } from './openai-parser'
import { resolveCommand } from './resolve'
import type { AssistantContext, AssistantResponse, ParsedCommand, ProviderName } from './types'

export function buildAssistantContext(overview: HouseholdOverviewDTO): AssistantContext {
  return {
    today: overview.today,
    timezone: overview.household.timezone,
    passMark: overview.household.passMark,
    students: overview.students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      subjects: s.enrollments.map((e) => ({
        subjectId: e.subjectId,
        subjectName: e.subjectName,
        current: e.current ? { recordId: e.current.recordId, paceNumber: e.current.paceNumber } : null,
        lastCompleted: e.lastCompleted
          ? { paceNumber: e.lastCompleted.paceNumber, completedOn: e.lastCompleted.completedOn, testScore: e.lastCompleted.testScore }
          : null
      }))
    })),
    subjects: overview.subjects
  }
}

/**
 * Text → structured command → proposals checked against real records.
 * Uses OpenAI when configured and falls back to the offline parser on any provider
 * failure, saying so — it never pretends a model call succeeded.
 */
export async function interpret(
  db: DbExecutor,
  household: Household,
  overview: HouseholdOverviewDTO,
  text: string
): Promise<AssistantResponse> {
  const ctx = buildAssistantContext(overview)
  ctx.today = todayIn(household.timezone)

  let parsed: ParsedCommand
  let provider: ProviderName = 'offline'
  let notice: string | null = null

  if (openAiConfigured()) {
    try {
      parsed = await parseWithOpenAI(text, ctx)
      provider = 'openai'
    } catch (error) {
      console.error('OpenAI parsing failed; using the offline parser instead.', error)
      parsed = parseOffline(text, ctx)
      notice = 'The AI service didn’t respond, so Folio’s offline parser read this instead.'
    }
  } else {
    parsed = parseOffline(text, ctx)
  }

  return resolveCommand(parsed, { db, household, ctx, provider, notice })
}
