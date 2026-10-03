import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, Files, Search } from 'lucide-react'
import { RecordsFilters } from '@/components/records/RecordsFilters'
import { RecordsTable } from '@/components/records/RecordsTable'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, PageHeader } from '@/components/ui/Misc'
import { plural } from '@/domain/format'
import { getDb } from '@/server/db'
import { getCurrentOverview } from '@/server/queries/current'
import { hasActiveFilters, listRecords, parseRecordFilters, RECORDS_PAGE_SIZE } from '@/server/queries/records'
import styles from '@/components/records/Records.module.css'

export const metadata: Metadata = { title: 'Records' }

export default async function RecordsPage(props: PageProps<'/records'>) {
  const params = await props.searchParams
  const { ctx, overview } = await getCurrentOverview()
  const filters = parseRecordFilters(params)
  const { rows, total, page, pageCount } = await listRecords(getDb(), ctx.household.id, filters)
  const filtered = hasActiveFilters(filters)

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && key !== 'page') query.set(key, String(value))
  const pageHref = (n: number) => {
    const p = new URLSearchParams(query)
    if (n > 1) p.set('page', String(n))
    return `/records${p.toString() ? `?${p}` : ''}`
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Records"
        description="Every PACE result for every child, in one searchable folder."
        actions={
          total > 0 ? (
            <ButtonLink href={`/records/export${query.toString() ? `?${query}` : ''}`} variant="secondary" icon={Download} prefetch={false}>
              Export CSV
            </ButtonLink>
          ) : null
        }
      />
      <RecordsFilters
        filters={filters}
        students={overview.students.map((s) => ({ id: s.id, name: s.displayName }))}
        subjects={overview.subjects}
        today={overview.today}
        schoolYearStart={overview.household.schoolYearStart}
      />
      <section className={styles.results} aria-label="Results">
        <p className={styles.count} aria-live="polite">
          {plural(total, 'record')}
          {filtered && total ? ' found' : ''}
          {pageCount > 1 ? (
            <span className="tabular">
              {' '}
              · showing {(page - 1) * RECORDS_PAGE_SIZE + 1}–{Math.min(page * RECORDS_PAGE_SIZE, total)}
            </span>
          ) : null}
        </p>
        <div className={styles.surface}>
          {rows.length === 0 ? (
            filtered ? (
              <EmptyState
                compact
                icon={Search}
                title="No records match"
                actions={
                  <ButtonLink href="/records" size="sm" variant="secondary">
                    Clear filters
                  </ButtonLink>
                }
              >
                Try a wider date range or fewer filters.
              </EmptyState>
            ) : (
              <EmptyState compact icon={Files} title="No records yet">
                Every PACE you log is filed here automatically, ready to search and export.
              </EmptyState>
            )
          ) : (
            <RecordsTable rows={rows} filters={filters} passMark={overview.household.passMark} today={overview.today} />
          )}
        </div>
        {pageCount > 1 ? (
          <nav className={styles.pagination} aria-label="Pages">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={styles.pageLink} scroll={false}>
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className={styles.pageInfo}>
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={pageHref(page + 1)} className={styles.pageLink} scroll={false}>
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  )
}
