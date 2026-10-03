import type { Metadata } from 'next'
import { ReportLauncher } from '@/components/reports/ReportLauncher'
import { PageHeader } from '@/components/ui/Misc'
import { addMonths, startOfMonth } from '@/domain/dates'
import { getCurrentOverview } from '@/server/queries/current'
import { REPORT_INFO, REPORT_TYPES } from '@/server/queries/reports'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const { overview } = await getCurrentOverview()
  const thisMonth = startOfMonth(overview.today)
  const months = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, -i).slice(0, 7))

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Printable summaries built from your records — for your files, a co-op, or a state portfolio."
      />
      <ReportLauncher
        reports={REPORT_TYPES.map((type) => ({ type, ...REPORT_INFO[type] }))}
        students={overview.students.map((s) => ({ id: s.id, name: s.displayName }))}
        subjects={overview.subjects}
        months={months}
        today={overview.today}
        schoolYearStart={overview.household.schoolYearStart}
      />
    </div>
  )
}
