import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ReportView } from '@/components/reports/ReportView'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, Panel } from '@/components/ui/Misc'
import { ScrollText } from 'lucide-react'
import { getDb } from '@/server/db'
import { getCurrentOverview } from '@/server/queries/current'
import type { Household } from '@/server/db/schema'
import { buildReport, REPORT_INFO, REPORT_TYPES, ReportInputError, type ReportDocument, type ReportType } from '@/server/queries/reports'

export async function generateMetadata(props: PageProps<'/reports/[type]'>): Promise<Metadata> {
  const { type } = await props.params
  return { title: (REPORT_INFO as Record<string, { title: string }>)[type]?.title ?? 'Report' }
}

export default async function ReportPage(props: PageProps<'/reports/[type]'>) {
  const { type } = await props.params
  if (!REPORT_TYPES.includes(type as ReportType)) notFound()
  const params = await props.searchParams
  const { ctx } = await getCurrentOverview()

  const loaded = await loadReport(ctx.household, type as ReportType, params)
  if ('missing' in loaded) {
    return (
      <Panel>
        <EmptyState icon={ScrollText} title="This report needs one more detail" actions={<ButtonLink href="/reports">Back to reports</ButtonLink>}>
          {loaded.missing}
        </EmptyState>
      </Panel>
    )
  }
  const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])))
  return <ReportView report={loaded.report} csvHref={`/reports/${type}/csv?${query.toString()}`} />
}

async function loadReport(
  household: Household,
  type: ReportType,
  params: Record<string, string | string[] | undefined>
): Promise<{ report: ReportDocument } | { missing: string }> {
  try {
    return { report: await buildReport(getDb(), household, type, params) }
  } catch (error) {
    if (error instanceof ReportInputError) return { missing: error.message }
    throw error
  }
}
