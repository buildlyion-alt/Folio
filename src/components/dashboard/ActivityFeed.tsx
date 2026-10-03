import Link from 'next/link'
import { ArrowRight, Check, Clock, Pencil, Play, RotateCcw, Trash } from 'lucide-react'
import { EmptyState, Panel } from '@/components/ui/Misc'
import { formatRelativeDay } from '@/domain/dates'
import type { ActivityDTO } from '@/domain/dto'
import { cx } from '@/lib/cx'
import styles from './Dashboard.module.css'

const VERB: Record<ActivityDTO['kind'], string> = {
  completed: 'completed',
  started: 'started',
  updated: 'updated',
  reopened: 'reopened',
  reset: 'reset',
  removed: 'removed the record for'
}

const ICON = { completed: Check, started: Play, updated: Pencil, reopened: RotateCcw, reset: RotateCcw, removed: Trash }

export function activitySentence(item: ActivityDTO): string {
  const score = item.kind === 'completed' && item.testScore !== null ? ` · ${item.testScore}%` : ''
  return `${item.studentName} ${VERB[item.kind]} ${item.subjectName} ${item.paceNumber}${score}`
}

export function ActivityFeed({ items, today, title = 'Recent activity' }: { items: ActivityDTO[]; today: string; title?: string }) {
  return (
    <Panel
      title={title}
      flush
      actions={
        <Link href="/records" className={styles.panelLink}>
          All records <ArrowRight aria-hidden strokeWidth={1.75} />
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState compact icon={Clock} title="No activity yet">
          Logged PACEs and test scores will appear here.
        </EmptyState>
      ) : (
        <ol className={styles.list}>
          {items.map((item) => {
            const Icon = ICON[item.kind]
            const source = item.source === 'assistant' ? 'via assistant' : item.source === 'onboarding' ? 'during setup' : null
            return (
              <li key={item.id} className={styles.listRow}>
                <span className={cx(styles.feedIcon, item.kind === 'completed' && styles.feedIconDone)} aria-hidden>
                  <Icon strokeWidth={2} />
                </span>
                <div className={styles.listText}>
                  <p className={styles.listPrimary}>
                    <Link href={`/students/${item.studentId}${item.recordId ? `?record=${item.recordId}` : ''}`} className={styles.feedLink}>
                      {item.studentName}
                    </Link>{' '}
                    <span className={styles.feedVerb}>{VERB[item.kind]}</span> {item.subjectName}{' '}
                    <span className="mono">{item.paceNumber}</span>
                    {item.kind === 'completed' && item.testScore !== null ? (
                      <span className={styles.feedScore}> · {item.testScore}%</span>
                    ) : null}
                  </p>
                  <p className={styles.listSecondary}>
                    {formatRelativeDay(item.occurredOn, today)}
                    {source ? ` · ${source}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
