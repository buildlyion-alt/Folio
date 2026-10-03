import type { Metadata } from 'next'
import Link from 'next/link'
import { ChartNoAxesColumn, TriangleAlert } from 'lucide-react'
import { PaceMeter, WeeklyChart } from '@/components/charts/WeeklyChart'
import { ButtonLink } from '@/components/ui/Button'
import { Avatar, EmptyState, PageHeader, Panel } from '@/components/ui/Misc'
import { tableStyles } from '@/components/ui/Table'
import { formatShortDate } from '@/domain/dates'
import { plural } from '@/domain/format'
import { getDb } from '@/server/db'
import { getCurrentOverview } from '@/server/queries/current'
import { getProgressAnalytics } from '@/server/queries/progress'
import { cx } from '@/lib/cx'
import styles from '@/components/charts/Progress.module.css'

export const metadata: Metadata = { title: 'Progress' }

function Delta({ current, previous, suffix = '', invert = false }: { current: number | null; previous: number | null; suffix?: string; invert?: boolean }) {
  if (current === null || previous === null) return <span className={styles.deltaNeutral}>No earlier data to compare</span>
  const diff = current - previous
  if (diff === 0) return <span className={styles.deltaNeutral}>Same as the previous period</span>
  const good = invert ? diff < 0 : diff > 0
  return (
    <span className={good ? styles.deltaGood : styles.deltaNeutral}>
      {diff > 0 ? '+' : '−'}
      {Math.abs(diff)}
      {suffix} vs previous period ({previous}
      {suffix})
    </span>
  )
}

export default async function ProgressPage(props: PageProps<'/progress'>) {
  const params = await props.searchParams
  const { ctx, overview } = await getCurrentOverview()
  const data = await getProgressAnalytics(getDb(), ctx.household, typeof params.period === 'string' ? params.period : undefined)
  const { summary, period } = data
  const passMark = ctx.household.passMark
  const ytdRatio = data.yearToDate.expected ? data.yearToDate.completed / data.yearToDate.expected : 0

  return (
    <div className={styles.page}>
      <PageHeader title="Progress" description="How each child is moving through their PACEs, from your records." />

      <nav className={styles.periods} aria-label="Period">
        <div className={styles.periodLinks}>
          {data.periods.map((p) => (
            <Link
              key={p.key}
              href={`/progress?period=${p.key}`}
              className={styles.periodLink}
              aria-current={p.key === period.key ? 'page' : undefined}
              scroll={false}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <span className={styles.rangeLabel}>{period.rangeLabel}</span>
      </nav>

      {!data.hasAnyRecords ? (
        <Panel>
          <EmptyState
            icon={ChartNoAxesColumn}
            title="No progress to chart yet"
            actions={
              <ButtonLink href="/home" variant="primary">
                Log progress
              </ButtonLink>
            }
          >
            Once you log completed PACEs and test scores, this page shows weekly pace, averages and who’s ahead or behind.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <dl className={styles.kpis}>
            <div>
              <dt>PACEs completed</dt>
              <dd className={styles.kpiValue}>{summary.completed}</dd>
              <dd className={styles.kpiMeta}>
                <Delta current={summary.completed} previous={summary.previousCompleted} />
              </dd>
            </div>
            <div>
              <dt>Average test score</dt>
              <dd className={styles.kpiValue}>{summary.averageScore !== null ? `${summary.averageScore}%` : '—'}</dd>
              <dd className={styles.kpiMeta}>
                <Delta current={summary.averageScore} previous={summary.previousAverage} suffix="%" />
              </dd>
            </div>
            <div>
              <dt>Below the {passMark}% pass mark</dt>
              <dd className={cx(styles.kpiValue, summary.belowPass > 0 && styles.warningValue)}>{summary.belowPass}</dd>
              <dd className={styles.kpiMeta}>{summary.belowPass ? 'Listed below for review' : 'Every test passed'}</dd>
            </div>
            <div>
              <dt>Days per PACE</dt>
              <dd className={styles.kpiValue}>{summary.averageDays ?? '—'}</dd>
              <dd className={styles.kpiMeta}>
                {ctx.household.pacesPerYear} a year means about {summary.expectedDays} days each
              </dd>
            </div>
          </dl>

          <Panel title="PACEs completed per week" meta={`Last 12 weeks · all students · target from ${ctx.household.pacesPerYear} PACEs per subject per year`}>
            <WeeklyChart data={data.weekly} target={data.weeklyTarget} today={overview.today} />
          </Panel>

          <div className={styles.columns}>
            <Panel title="By student" meta={period.label} flush>
              <div className={tableStyles.scroll}>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Completed vs expected</th>
                      <th scope="col" className={tableStyles.num}>
                        Avg. score
                      </th>
                      <th scope="col" className={tableStyles.num}>
                        Days / PACE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byStudent.map((s) => (
                      <tr key={s.studentId}>
                        <td>
                          <Link href={`/students/${s.studentId}`} className={styles.studentCell}>
                            <Avatar initials={s.initials} seed={s.studentId} size="sm" />
                            {s.name.split(' ')[0]}
                          </Link>
                        </td>
                        <td>
                          <span className={styles.meterCell}>
                            <PaceMeter value={s.completed} expected={s.expected} />
                            <span className="tabular">
                              {s.completed} <span className={tableStyles.muted}>of {formatExpected(s.expected)}</span>
                            </span>
                          </span>
                        </td>
                        <td className={cx(tableStyles.num, s.averageScore !== null && s.averageScore < passMark && styles.danger)}>
                          {s.averageScore !== null ? `${s.averageScore}%` : '—'}
                        </td>
                        <td className={cx(tableStyles.num, s.averageDays === null && tableStyles.muted)}>{s.averageDays ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="By subject" meta={period.label} flush>
              <div className={tableStyles.scroll}>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col" className={tableStyles.num}>
                        Completed
                      </th>
                      <th scope="col" className={tableStyles.num}>
                        Avg. score
                      </th>
                      <th scope="col" className={tableStyles.num}>
                        Students
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySubject.map((s) => (
                      <tr key={s.subjectId}>
                        <td>
                          <Link href={`/records?subject=${s.subjectId}&status=completed&from=${period.range.from}&to=${period.range.to}`} className={styles.subjectLink}>
                            {s.name}
                          </Link>
                        </td>
                        <td className={cx(tableStyles.num, !s.completed && tableStyles.muted)}>{s.completed || '—'}</td>
                        <td className={cx(tableStyles.num, s.averageScore !== null && s.averageScore < passMark && styles.danger)}>
                          {s.averageScore !== null ? `${s.averageScore}%` : '—'}
                        </td>
                        <td className={cx(tableStyles.num, tableStyles.muted)}>{s.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className={styles.columns}>
            <Panel title="School year to date" meta={`Since ${formatShortDate(data.yearToDate.schoolYearStart, overview.today)}`}>
              <div className={styles.ytd}>
                <p className={styles.ytdValue}>
                  {data.yearToDate.completed}
                  <span className={styles.ytdOf}> of about {data.yearToDate.expected} expected by now</span>
                </p>
                <span className={styles.ytdTrack} aria-hidden>
                  <span
                    className={cx(styles.ytdFill, ytdRatio >= 0.95 && styles.ytdGood, ytdRatio < 0.6 && styles.ytdBehind)}
                    style={{ width: `${Math.min(100, Math.round(ytdRatio * 100))}%` }}
                  />
                </span>
                <p className={styles.ytdNote}>
                  {ytdRatio >= 1
                    ? 'Ahead of the yearly target.'
                    : ytdRatio >= 0.95
                      ? 'On pace for the yearly target.'
                      : `About ${Math.max(0, data.yearToDate.expected - data.yearToDate.completed)} PACEs behind the yearly target.`}{' '}
                  Change the target or school-year start in <Link href="/settings">Settings</Link>.
                </p>
              </div>
            </Panel>

            <Panel title="Scores below the pass mark" meta={period.label} flush>
              {data.lowScores.length === 0 ? (
                <EmptyState compact icon={ChartNoAxesColumn} title="No tests below the pass mark">
                  Every PACE Test in this period scored {passMark}% or higher.
                </EmptyState>
              ) : (
                <ul className={styles.lowList}>
                  {data.lowScores.map((r) => (
                    <li key={r.recordId}>
                      <Link href={`/progress?period=${period.key}&record=${r.recordId}`} scroll={false} className={styles.lowRow}>
                        <TriangleAlert aria-hidden strokeWidth={2} />
                        <span className={styles.lowText}>
                          {r.studentName} · {r.subjectName} <span className="mono">{r.paceNumber}</span>
                        </span>
                        <span className={cx(styles.danger, 'tabular')}>{r.score}%</span>
                        <span className={styles.lowDate}>{formatShortDate(r.completedOn, overview.today)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <p className={styles.footnote}>
            {plural(overview.totals.enrollments, 'active subject')} across {plural(overview.totals.students, 'student')}. Figures come straight from your PACE records.
          </p>
        </>
      )}
    </div>
  )
}

/** Expected PACEs for a period: “~3”, or “<1” early in a period rather than a misleading “~0”. */
function formatExpected(expected: number): string {
  if (expected <= 0) return '0'
  return expected < 0.5 ? '<1' : `~${Math.round(expected)}`
}
