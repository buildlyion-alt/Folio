import type { HouseholdTotalsDTO } from '@/domain/dto'
import { plural } from '@/domain/format'
import { cx } from '@/lib/cx'
import styles from './Dashboard.module.css'

export function SummaryStrip({ totals, hasCompletions }: { totals: HouseholdTotalsDTO; hasCompletions: boolean }) {
  const delta = totals.completedThisWeek - totals.completedLastWeek
  return (
    <dl className={styles.summary} aria-label="Homeschool summary">
      <div className={styles.metric}>
        <dt>Students</dt>
        <dd className={styles.metricValue}>{totals.students}</dd>
        <dd className={styles.metricMeta}>{totals.enrollments} active subjects</dd>
      </div>
      <div className={styles.metric}>
        <dt>Active PACEs</dt>
        <dd className={styles.metricValue}>{totals.activePaces}</dd>
        <dd className={styles.metricMeta}>in progress now</dd>
      </div>
      <div className={styles.metric}>
        <dt>Completed this week</dt>
        <dd className={styles.metricValue}>{totals.completedThisWeek}</dd>
        <dd className={cx(styles.metricMeta, delta > 0 && styles.metricUp)}>
          {hasCompletions
            ? delta === 0
              ? `Same as last week`
              : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs last week (${totals.completedLastWeek})`
            : 'No completions logged yet'}
        </dd>
      </div>
      <div className={styles.metric}>
        <dt>Average test score</dt>
        <dd className={styles.metricValue}>{totals.averageScore !== null ? `${totals.averageScore}%` : '—'}</dd>
        <dd className={styles.metricMeta}>
          {totals.scoredThisYear ? `${plural(totals.scoredThisYear, 'test')} this school year` : 'Shows once scores are logged'}
        </dd>
      </div>
    </dl>
  )
}
