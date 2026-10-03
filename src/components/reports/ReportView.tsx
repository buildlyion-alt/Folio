import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/lib/cx'
import type { ReportDocument } from '@/server/queries/reports'
import { PrintButton } from './PrintButton'
import styles from './Reports.module.css'

export function ReportView({ report, csvHref }: { report: ReportDocument; csvHref: string }) {
  return (
    <div className={styles.viewer}>
      <div className={cx(styles.toolbar, 'no-print')}>
        <Link href="/reports" className={styles.back}>
          <ArrowLeft aria-hidden strokeWidth={1.75} /> Reports
        </Link>
        <div className={styles.toolbarActions}>
          <ButtonLink href={csvHref} variant="secondary" icon={Download} prefetch={false}>
            Download CSV
          </ButtonLink>
          <PrintButton />
        </div>
      </div>

      <article className={styles.document} aria-labelledby="report-title">
        <header className={styles.docHeader}>
          <p className={styles.docHousehold}>{report.householdName}</p>
          <h1 id="report-title" className={styles.docTitle}>
            {report.title}
            {report.subtitle ? <span className={styles.docSubtitle}> · {report.subtitle}</span> : null}
          </h1>
          <p className={styles.docMeta}>
            {report.periodLabel} · Generated {report.generatedOn}
          </p>
        </header>

        <section className={styles.docSummary} aria-label="Summary">
          {report.summary.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </section>

        {report.sections.map((section, index) =>
          section.kind === 'kpis' ? (
            <dl key={index} className={styles.docKpis}>
              {section.items.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd className={styles.docKpiValue}>{item.value}</dd>
                  {item.meta ? <dd className={styles.docKpiMeta}>{item.meta}</dd> : null}
                </div>
              ))}
            </dl>
          ) : (
            <section key={index} className={styles.docSection} aria-labelledby={`report-section-${index}`}>
              <h2 id={`report-section-${index}`} className={styles.docSectionTitle}>
                {section.title}
              </h2>
              {section.rows.length === 0 ? (
                <p className={styles.docEmpty}>{section.empty}</p>
              ) : (
                <table className={styles.docTable}>
                  <thead>
                    <tr>
                      {section.columns.map((column) => (
                        <th key={column.key} scope="col" className={cx(column.align === 'end' && styles.alignEnd)}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className={cx(section.flags?.includes(rowIndex) && styles.flagged)}>
                        {section.columns.map((column) => (
                          <td
                            key={column.key}
                            className={cx(
                              column.align === 'end' && styles.alignEnd,
                              column.mono && 'mono',
                              column.key === 'notes' && styles.notesCell,
                              column.key === 'student' && styles.nowrap
                            )}
                          >
                            {row[column.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        )}

        <footer className={styles.docFooter}>
          Prepared with Folio from {report.householdName}’s PACE records. Pass mark and dates follow the household’s settings.
        </footer>
      </article>
    </div>
  )
}
