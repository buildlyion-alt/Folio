'use client'

import { useLogProgress } from '@/components/log/LogProgressProvider'
import type { HouseholdOverviewDTO } from '@/domain/dto'
import { describeSignal } from '@/domain/health'
import styles from './Home.module.css'

/** Only real concerns — a test below the pass mark, a PACE running long. Hidden when there are none. */
export function NeedsALook({ overview }: { overview: HouseholdOverviewDTO }) {
  const openLog = useLogProgress()
  const items = overview.students.flatMap((student) => student.concerns.map((concern) => ({ student, concern })))
  if (items.length === 0) return null

  return (
    <section aria-labelledby="look-heading" className={styles.look}>
      <h2 id="look-heading" className={styles.sectionTitle}>
        Needs a look
      </h2>
      <ul className={styles.lookList}>
        {items.map(({ student, concern }) => {
          const { signal } = concern
          const paceNumber = signal.kind === 'no_active' ? undefined : signal.paceNumber
          return (
            <li key={`${student.id}-${concern.subjectId}-${signal.kind}`}>
              <button
                type="button"
                className={styles.lookItem}
                onClick={() => openLog({ studentId: student.id, subjectId: concern.subjectId, paceNumber, status: 'completed' })}
              >
                <span className={styles.flag} aria-hidden />
                <span className={styles.lookText}>
                  <span className={styles.lookName}>{student.firstName}</span> · {describeSignal(signal, concern.subjectName)}
                </span>
                <span className={styles.lookAction}>{signal.kind === 'below_pass' ? 'Log retest' : 'Log progress'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
