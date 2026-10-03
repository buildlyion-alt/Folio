'use client'

import Link from 'next/link'
import { useLogProgress, type LogPrefill } from '@/components/log/LogProgressProvider'
import { Avatar } from '@/components/ui/Misc'
import type { EnrollmentDTO, HouseholdOverviewDTO, StudentOverviewDTO } from '@/domain/dto'
import { describeSignal, isConcern } from '@/domain/health'
import { plural } from '@/domain/format'
import { cx } from '@/lib/cx'
import styles from './Home.module.css'

/** What tapping a subject does: finish the current PACE, or start the next one. */
export function prefillFor(student: StudentOverviewDTO, enrollment: EnrollmentDTO): LogPrefill {
  const next = enrollment.signals.find((s) => s.kind === 'no_active')
  return {
    studentId: student.id,
    subjectId: enrollment.subjectId,
    paceNumber: enrollment.current?.paceNumber ?? (next?.kind === 'no_active' ? (next.nextPace ?? undefined) : undefined),
    status: enrollment.current ? 'completed' : 'active'
  }
}

function cellLabel(student: StudentOverviewDTO, enrollment: EnrollmentDTO): string {
  const concern = enrollment.signals.find(isConcern)
  const now = enrollment.current ? `on ${enrollment.current.paceNumber}` : 'nothing in progress'
  return `${student.firstName}, ${enrollment.subjectName}: ${now}${concern ? `. Needs a look: ${describeSignal(concern, enrollment.subjectName)}` : ''}. Log progress.`
}

function PaceCell({ student, enrollment }: { student: StudentOverviewDTO; enrollment: EnrollmentDTO }) {
  const openLog = useLogProgress()
  const concern = enrollment.signals.some(isConcern)
  return (
    <button
      type="button"
      className={cx(styles.pace, !enrollment.current && styles.paceIdle)}
      aria-label={cellLabel(student, enrollment)}
      onClick={() => openLog(prefillFor(student, enrollment))}
    >
      <span className="mono">{enrollment.current ? enrollment.current.paceNumber : '—'}</span>
      {concern ? <span className={styles.flag} aria-hidden /> : null}
    </button>
  )
}

export function StudentOverview({ overview }: { overview: HouseholdOverviewDTO }) {
  const { subjects, students } = overview
  const usedSubjects = subjects.filter((subject) => students.some((s) => s.enrollments.some((e) => e.subjectId === subject.id)))
  const anyConcern = students.some((s) => s.concerns.length > 0)

  return (
    <section aria-labelledby="students-heading" className={styles.overview}>
      <div className={styles.overviewHead}>
        <h2 id="students-heading" className={styles.sectionTitle}>
          What everyone is working on
        </h2>
        <p className={styles.sectionHint}>
          Current PACE in each subject. Select one to log progress.
          {anyConcern ? (
            <span className={styles.legend}>
              <span className={styles.flag} aria-hidden /> needs a look
            </span>
          ) : null}
        </p>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.nameCol}>
                Student
              </th>
              {usedSubjects.map((subject) => (
                <th scope="col" key={subject.id}>
                  {subject.name}
                </th>
              ))}
              <th scope="col" className={styles.weekCol}>
                This week
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <th scope="row" className={styles.nameCol}>
                  <Link href={`/students/${student.id}`} className={styles.student}>
                    <Avatar initials={student.initials} seed={student.id} size="sm" />
                    {student.firstName}
                  </Link>
                </th>
                {usedSubjects.map((subject) => {
                  const enrollment = student.enrollments.find((e) => e.subjectId === subject.id)
                  return (
                    <td key={subject.id}>
                      {enrollment ? (
                        <PaceCell student={student} enrollment={enrollment} />
                      ) : (
                        <span className="visually-hidden">{`${student.firstName} doesn’t take ${subject.name}`}</span>
                      )}
                    </td>
                  )
                })}
                <td className={cx(styles.weekCol, 'tabular', !student.completedThisWeek && styles.zero)}>
                  {student.completedThisWeek || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one block per child; subjects in a two-column grid. */}
      <ul className={styles.blocks}>
        {students.map((student) => (
          <li key={student.id} className={styles.block}>
            <Link href={`/students/${student.id}`} className={styles.blockHead}>
              <Avatar initials={student.initials} seed={student.id} size="sm" />
              <span className={styles.blockName}>{student.firstName}</span>
              <span className={styles.blockWeek}>
                {student.completedThisWeek ? `${plural(student.completedThisWeek, 'PACE')} this week` : 'None this week'}
              </span>
            </Link>
            <div className={styles.blockGrid}>
              {student.enrollments.map((enrollment) => (
                <BlockCell key={enrollment.enrollmentId} student={student} enrollment={enrollment} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function BlockCell({ student, enrollment }: { student: StudentOverviewDTO; enrollment: EnrollmentDTO }) {
  const openLog = useLogProgress()
  const concern = enrollment.signals.some(isConcern)
  return (
    <button type="button" className={styles.blockCell} aria-label={cellLabel(student, enrollment)} onClick={() => openLog(prefillFor(student, enrollment))}>
      <span className={styles.blockSubject}>{enrollment.subjectName}</span>
      <span className={styles.blockPace}>
        <span className={cx('mono', !enrollment.current && styles.zero)}>{enrollment.current?.paceNumber ?? '—'}</span>
        {concern ? <span className={styles.flag} aria-hidden /> : null}
      </span>
    </button>
  )
}
