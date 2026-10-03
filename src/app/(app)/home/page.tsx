import type { Metadata } from 'next'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { AttentionList, type AttentionItem } from '@/components/dashboard/AttentionList'
import { GettingStarted } from '@/components/dashboard/GettingStarted'
import { ProgressMatrix } from '@/components/dashboard/ProgressMatrix'
import { SummaryStrip } from '@/components/dashboard/SummaryStrip'
import { AssistantComposer } from '@/components/assistant/AssistantComposer'
import { NoStudents } from '@/components/students/NoStudents'
import { formatWeekdayDate, greetingFor, hourIn } from '@/domain/dates'
import { firstWord } from '@/domain/format'
import { getDb } from '@/server/db'
import { getRecentActivity } from '@/server/queries/activity'
import { getCurrentOverview } from '@/server/queries/current'
import styles from '@/components/dashboard/Dashboard.module.css'

export const metadata: Metadata = { title: 'Home' }

export default async function HomePage() {
  const { ctx, overview } = await getCurrentOverview()
  // Setup entries (current positions from onboarding) aren't progress — keep the feed about real work.
  const activity = await getRecentActivity(getDb(), ctx.household.id, { limit: 10, excludeSources: ['onboarding'] })
  const greeting = greetingFor(hourIn(ctx.household.timezone))
  const hasCompletions = overview.students.some((s) => s.enrollments.some((e) => e.completedTotal > 0))

  const attention: AttentionItem[] = overview.students.flatMap((student) => [
    ...student.concerns.map((c) => ({ ...c, studentId: student.id, studentName: student.firstName, initials: student.initials, kind: 'concern' as const })),
    ...student.todos.map((c) => ({ ...c, studentId: student.id, studentName: student.firstName, initials: student.initials, kind: 'todo' as const }))
  ])

  return (
    <div className={styles.page}>
      <header className={styles.greeting}>
        <div>
          <h1 className={styles.greetingTitle}>
            {greeting}, {firstWord(ctx.user.name)}.
          </h1>
          <p className={styles.greetingText}>
            {overview.students.length
              ? 'Here’s how everyone is progressing.'
              : 'Add your students to start tracking PACE progress.'}
          </p>
        </div>
        <p className={styles.date}>{formatWeekdayDate(overview.today)}</p>
      </header>

      {overview.students.length === 0 ? (
        <NoStudents />
      ) : (
        <>
          <AssistantComposer />
          <SummaryStrip totals={overview.totals} hasCompletions={hasCompletions} />
          {!hasCompletions ? <GettingStarted firstStudent={overview.students[0]} /> : null}
          <ProgressMatrix overview={overview} />
          <div className={styles.columns}>
            <AttentionList items={attention} />
            <ActivityFeed items={activity} today={overview.today} />
          </div>
        </>
      )}
    </div>
  )
}
