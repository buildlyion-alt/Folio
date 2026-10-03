import 'server-only'
import { cache } from 'react'
import { requireHousehold } from '../auth/context'
import { getDb } from '../db'
import { getHouseholdOverview } from './overview'

/** The signed-in household's overview, computed once per request and shared by layout and page. */
export const getCurrentOverview = cache(async () => {
  const ctx = await requireHousehold()
  return { ctx, overview: await getHouseholdOverview(getDb(), ctx.household) }
})
