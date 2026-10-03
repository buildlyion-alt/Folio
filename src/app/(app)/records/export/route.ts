import { todayIn } from '@/domain/dates'
import { PACE_STATUS_LABEL } from '@/domain/pace'
import { csvResponse } from '@/lib/csv'
import { getDb } from '@/server/db'
import { getHouseholdContext } from '@/server/auth/context'
import { listRecords, parseRecordFilters } from '@/server/queries/records'

export async function GET(request: Request) {
  const ctx = await getHouseholdContext()
  if (!ctx) return new Response('Unauthorized', { status: 401 })

  const url = new URL(request.url)
  const filters = parseRecordFilters(Object.fromEntries(url.searchParams))
  const { rows } = await listRecords(getDb(), ctx.household.id, filters, { all: true })

  const slug = ctx.household.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'folio'
  return csvResponse(`${slug}-records-${todayIn(ctx.household.timezone)}.csv`, [
    ['Student', 'Subject', 'PACE', 'Status', 'Started', 'Completed', 'Test score', 'Notes'],
    ...rows.map((r) => [r.studentName, r.subjectName, r.paceNumber, PACE_STATUS_LABEL[r.status], r.startedOn, r.completedOn, r.testScore, r.notes])
  ])
}
