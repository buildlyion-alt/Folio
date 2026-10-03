import { csvResponse } from '@/lib/csv'
import { getDb } from '@/server/db'
import { getHouseholdContext } from '@/server/auth/context'
import { buildReport, REPORT_TYPES, ReportInputError, type ReportType } from '@/server/queries/reports'

export async function GET(request: Request, ctx: RouteContext<'/reports/[type]/csv'>) {
  const household = await getHouseholdContext()
  if (!household) return new Response('Unauthorized', { status: 401 })
  const { type } = await ctx.params
  if (!REPORT_TYPES.includes(type as ReportType)) return new Response('Not found', { status: 404 })

  try {
    const url = new URL(request.url)
    const report = await buildReport(getDb(), household.household, type as ReportType, Object.fromEntries(url.searchParams))
    return csvResponse(report.csv.filename, [report.csv.header, ...report.csv.rows])
  } catch (error) {
    if (error instanceof ReportInputError) return new Response(error.message, { status: 400 })
    throw error
  }
}
