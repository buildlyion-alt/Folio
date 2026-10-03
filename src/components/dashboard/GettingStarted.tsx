'use client'

import { Plus, Sparkles } from 'lucide-react'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { Button } from '@/components/ui/Button'
import type { StudentOverviewDTO } from '@/domain/dto'
import styles from './Dashboard.module.css'

/** First-run guidance shown until the first PACE is completed — instead of a wall of zeros. */
export function GettingStarted({ firstStudent }: { firstStudent: StudentOverviewDTO }) {
  const openLog = useLogProgress()
  const subject = firstStudent.enrollments.find((e) => e.current) ?? firstStudent.enrollments[0]
  const example = subject?.current
    ? `${firstStudent.firstName} completed ${subject.subjectName} ${subject.current.paceNumber} with 94%`
    : `${firstStudent.firstName} completed Math 1084 with 94%`

  return (
    <section className={styles.gettingStarted} aria-labelledby="getting-started-title">
      <div className={styles.gettingStartedText}>
        <h2 id="getting-started-title" className={styles.gettingStartedTitle}>
          <Sparkles aria-hidden strokeWidth={1.75} />
          Log your first completed PACE
        </h2>
        <p>
          When a child finishes a PACE Test, record it here. Folio updates the chart, averages, records and reports
          from that one entry — or just type it above: <span className={styles.exampleText}>“{example}”</span>.
        </p>
      </div>
      <div className={styles.gettingStartedActions}>
        <Button icon={Plus} onClick={() => openLog({ studentId: firstStudent.id, subjectId: subject?.subjectId })}>
          Log progress
        </Button>
        <span className={styles.gettingStartedHint}>Past PACEs can be added from each student’s profile.</span>
      </div>
    </section>
  )
}
