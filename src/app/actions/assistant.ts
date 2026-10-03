'use server'

import { revalidatePath } from 'next/cache'
import { todayIn } from '@/domain/dates'
import { getDb } from '@/server/db'
import { getHouseholdContext } from '@/server/auth/context'
import { interpret } from '@/server/assistant/interpret'
import type { AssistantResponse } from '@/server/assistant/types'
import { getHouseholdOverview } from '@/server/queries/overview'
import { searchHousehold, type SearchResults } from '@/server/queries/search'
import { applyConfirmedChanges, confirmedChangesSchema, type AppliedChange } from '@/server/services/assistant'
import { ProgressError } from '@/server/services/progress'

const SIGNED_OUT = 'Your session has ended. Sign in again to continue.'

export async function interpretText(
  text: string
): Promise<{ ok: true; data: AssistantResponse } | { ok: false; error: string }> {
  const ctx = await getHouseholdContext()
  if (!ctx) return { ok: false, error: SIGNED_OUT }
  const input = text.trim().slice(0, 500)
  if (!input) return { ok: false, error: 'Type what happened, or a question.' }
  try {
    const db = getDb()
    const overview = await getHouseholdOverview(db, ctx.household)
    return { ok: true, data: await interpret(db, ctx.household, overview, input) }
  } catch (error) {
    console.error('interpretText failed', error)
    return { ok: false, error: 'Something went wrong reading that. Please try again.' }
  }
}

/**
 * Writes assistant proposals after the parent confirmed them, marked as assistant-sourced
 * in the audit trail. The household comes from the session, never from the request.
 */
export async function applyAssistantChanges(
  changes: unknown
): Promise<{ ok: true; data: AppliedChange[] } | { ok: false; error: string }> {
  const ctx = await getHouseholdContext()
  if (!ctx) return { ok: false, error: SIGNED_OUT }
  const parsed = confirmedChangesSchema.safeParse(changes)
  if (!parsed.success) return { ok: false, error: 'Those changes are incomplete — edit them and try again.' }

  try {
    const applied = await applyConfirmedChanges(
      getDb(),
      { householdId: ctx.household.id, actorUserId: ctx.user.id, source: 'assistant', today: todayIn(ctx.household.timezone) },
      parsed.data
    )
    revalidatePath('/', 'layout')
    return { ok: true, data: applied }
  } catch (error) {
    if (error instanceof ProgressError) return { ok: false, error: error.message }
    console.error('applyAssistantChanges failed', error)
    return { ok: false, error: 'Nothing was saved — something went wrong. Please try again.' }
  }
}

export async function search(query: string): Promise<SearchResults> {
  const ctx = await getHouseholdContext()
  if (!ctx) return { students: [], subjects: [], records: [] }
  return searchHousehold(getDb(), ctx.household.id, query.trim().slice(0, 80))
}
