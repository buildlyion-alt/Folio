import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ScrollText } from 'lucide-react'
import { ReportOptions } from '@/components/reports/ReportOptions'
import { ReportView } from '@/components/reports/ReportView'
import { currentPeriod, defaultReportHref, periodOptions } from '@/components/reports/reportDefaults'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Misc'
import { getDb } from '@/server/db'
import { getCurrentOverview } from '@/server/queries/current'
import type { Household } from '@/server/db/schema'
import { buildReport, REPORT_INFO, REPORT_TYPES, ReportInputError, type ReportDocument, type ReportType } from '@/server/queries/reports'
import styles from '@/components/reports/Reports.module.css'

export async function generateMetadata(props: PageProps<'/reports/[type]'>): Promise<Metadata> {
  const { type } = await props.params
  return { title: (REPORT_INFO as Record<string, { title: string }>)[type]?.title ?? 'Report' }
}

export default async function ReportPage(props: PageProps<'/reports/[type]'>) {
  const { type: rawType } = await props.params
  if (!REPORT_TYPES.includes(rawType as ReportType)) notFound()
  const type = rawType as ReportType
  const raw = await props.searchParams
  const params: Record<string, string> = Object.fromEntries(Object.entries(raw).flatMap(([k, v]) => (typeof v === 'string' && v ? [[k, v]] : [])))
  const { ctx, overview } = await getCurrentOverview()
  const info = REPORT_INFO[type]

  const enrolled = new Set(overview.students.flatMap((s) => s.enrollments.map((e) => e.subjectId)))
  const targets =
    info.needs === 'student'
      ? overview.students.map((s) => ({ id: s.id, name: s.displayName }))
      : info.needs === 'subject'
        ? overview.subjects.filter((s) => enrolled.has(s.id)).map((s) => ({ id: s.id, name: s.name }))
        : []

  // A report about one child or subject opens on the first one instead of stopping to ask.
  if (info.needs && !targets.some((t) => t.id === params[info.needs!])) {
    const fallback = new URL(defaultReportHref(type, overview), 'http://folio.local').searchParams.get(info.needs)
    if (fallback) redirect(`/reports/${type}?${new URLSearchParams({ ...params, [info.needs]: fallback }).toString()}`)
  }

  const loaded = await loadReport(ctx.household, type, params)
  if ('missing' in loaded) {
    return (
      <div className={styles.missing}>
        <EmptyState
          icon={ScrollText}
          title={info.needs === 'student' ? 'Add a student first' : 'Add a subject first'}
          actions={
            <ButtonLink href="/reports" variant="secondary">
              Back to reports
            </ButtonLink>
          }
        >
          {loaded.missing}
        </EmptyState>
      </div>
    )
  }

  const schoolYearStart = overview.household.schoolYearStart
  const periodParams = Object.fromEntries(Object.entries(params).filter(([k]) => k === 'from' || k === 'to' || k === 'month'))
  const query = new URLSearchParams(params)

  return (
    <ReportView
      report={loaded.report}
      csvHref={`/reports/${type}/csv?${query.toString()}`}
      options={
        <ReportOptions
          type={type}
          needs={info.needs}
          targets={targets}
          target={info.needs ? (params[info.needs] ?? null) : null}
          periods={periodOptions(type, overview.today, schoolYearStart)}
          period={currentPeriod(type, params, overview.today, schoolYearStart)}
          periodLabel={loaded.report.periodLabel}
          periodParams={periodParams}
        />
      }
    />
  )
}

async function loadReport(
  household: Household,
  type: ReportType,
  params: Record<string, string>
): Promise<{ report: ReportDocument } | { missing: string }> {
  try {
    return { report: await buildReport(getDb(), household, type, params) }
  } catch (error) {
    if (error instanceof ReportInputError) return { missing: error.message }
    throw error
  }
}
