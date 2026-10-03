import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { getCurrentOverview } from '@/server/queries/current'
import { REPORT_INFO, REPORT_TYPES } from '@/server/queries/reports'
import { defaultReportHref } from '@/components/reports/reportDefaults'
import styles from '@/components/reports/Reports.module.css'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const { overview } = await getCurrentOverview()

  return (
    <div className={styles.index}>
      <PageHeader
        title="Reports"
        description="Printable summaries built from your records, for your files, a co-op or a state portfolio."
      />
      <ul className={styles.list}>
        {REPORT_TYPES.map((type) => (
          <li key={type}>
            <Link href={defaultReportHref(type, overview)} className={styles.listRow}>
              <span className={styles.listText}>
                <span className={styles.listTitle}>{REPORT_INFO[type].title}</span>
                <span className={styles.listDescription}>{REPORT_INFO[type].description}</span>
              </span>
              <ChevronRight className={styles.chevron} aria-hidden strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
