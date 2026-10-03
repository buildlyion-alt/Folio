import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { householdMembers, households, type Household } from '../db/schema'
import { readSessionToken } from './cookies'
import { validateSessionToken, type ValidSession } from './session'

/*
 * The data access layer's entry point. Every page, server action and route handler that
 * touches academic data starts here. The household is always derived from the signed-in
 * user's membership — a household ID sent by the browser is never trusted.
 */

export const getSession = cache(async (): Promise<ValidSession | null> => {
  const token = await readSessionToken()
  if (!token) return null
  return validateSessionToken(getDb(), token)
})

export async function requireSession(): Promise<ValidSession> {
  const session = await getSession()
  if (!session) redirect('/sign-in')
  return session
}

export interface HouseholdContext {
  session: ValidSession
  user: ValidSession['user']
  household: Household
  role: 'owner' | 'educator'
}

export const getMembership = cache(async (userId: string) => {
  const [row] = await getDb()
    .select({ household: households, role: householdMembers.role })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(householdMembers.createdAt))
    .limit(1)
  return row ?? null
})

/** Signed in, with a household that has finished onboarding — otherwise redirect. */
export async function requireHousehold(): Promise<HouseholdContext> {
  const session = await requireSession()
  const membership = await getMembership(session.user.id)
  if (!membership || !membership.household.onboardedAt) redirect('/onboarding')
  return {
    session,
    user: session.user,
    household: membership.household,
    role: membership.role
  }
}

/**
 * For server actions called from client components: same checks, but returns null
 * instead of redirecting so the action can respond with a clean error.
 */
export async function getHouseholdContext(): Promise<HouseholdContext | null> {
  const session = await getSession()
  if (!session) return null
  const membership = await getMembership(session.user.id)
  if (!membership || !membership.household.onboardedAt) return null
  return { session, user: session.user, household: membership.household, role: membership.role }
}
