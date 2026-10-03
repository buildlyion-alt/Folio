import type { Metadata } from 'next'
import { AssistantComposer } from '@/components/assistant/AssistantComposer'
import { NeedsALook } from '@/components/home/NeedsALook'
import { StudentOverview } from '@/components/home/StudentOverview'
import { NoStudents } from '@/components/students/NoStudents'
import { greetingFor, hourIn } from '@/domain/dates'
import { firstWord, plural } from '@/domain/format'
import { getCurrentOverview } from '@/server/queries/current'
import styles from '@/components/home/Home.module.css'

export const metadata: Metadata = { title: 'Home' }

export default async function HomePage() {
  const { ctx, overview } = await getCurrentOverview()
  const { totals, students } = overview
  const greeting = greetingFor(hourIn(ctx.household.timezone))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {greeting}, {firstWord(ctx.user.name)}.
        </h1>
        {students.length ? (
          <p className={styles.summary}>
            <span>
              <strong>{totals.students}</strong> {plural(totals.students, 'student').replace(/^\d+ /, '')}
            </span>
            <span>
              <strong>{totals.completedThisWeek}</strong> {plural(totals.completedThisWeek, 'PACE').replace(/^\d+ /, '')} completed this week
            </span>
            {totals.averageScore !== null ? (
              <span>
                <strong>{totals.averageScore}%</strong> average score
              </span>
            ) : null}
          </p>
        ) : (
          <p className={styles.summary}>Add your students to start keeping PACE records.</p>
        )}
      </header>

      {students.length === 0 ? (
        <NoStudents />
      ) : (
        <>
          <AssistantComposer placeholder="Tell Folio what happened — “Gabriel finished Math 1084 with 94%”" />
          <StudentOverview overview={overview} />
          <NeedsALook overview={overview} />
        </>
      )}
    </div>
  )
}
