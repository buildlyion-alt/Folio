'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { Avatar, Panel, StudentStatusLabel } from '@/components/ui/Misc'
import { formatRelativeDay } from '@/domain/dates'
import type { EnrollmentDTO, HouseholdOverviewDTO, StudentOverviewDTO } from '@/domain/dto'
import { describeSignal, isConcern } from '@/domain/health'
import { subjectShortName } from '@/domain/subjects'
import { cx } from '@/lib/cx'
import styles from './Dashboard.module.css'

function cellLabel(student: StudentOverviewDTO, enrollment: EnrollmentDTO): string {
  const parts = [`${student.firstName}, ${enrollment.subjectName}`]
  if (enrollment.current) parts.push(`${enrollment.current.paceNumber} in progress`)
  else parts.push('no PACE in progress')
  for (const signal of enrollment.signals.filter(isConcern)) parts.push(describeSignal(signal, enrollment.subjectName))
  if (enrollment.completedThisWeek) parts.push(`${enrollment.completedThisWeek} completed this week`)
  return `${parts.join(' — ')}. Log progress.`
}

function Cell({ student, enrollment }: { student: StudentOverviewDTO; enrollment: EnrollmentDTO }) {
  const openLog = useLogProgress()
  const concern = enrollment.signals.find(isConcern)
  const next = enrollment.signals.find((s) => s.kind === 'no_active')
  const nextPace = next?.kind === 'no_active' ? next.nextPace : null

  return (
    <button
      type="button"
      className={cx(styles.cell, !enrollment.current && styles.cellIdle)}
      aria-label={cellLabel(student, enrollment)}
      title={concern ? describeSignal(concern, enrollment.subjectName) : undefined}
      onClick={() =>
        openLog({
          studentId: student.id,
          subjectId: enrollment.subjectId,
          paceNumber: enrollment.current?.paceNumber ?? nextPace ?? undefined,
          status: enrollment.current ? 'completed' : 'active'
        })
      }
    >
      <span className={styles.cellMarks} aria-hidden>
        {concern ? <span className={styles.markWarning} /> : enrollment.completedThisWeek ? <span className={styles.markSignal} /> : null}
      </span>
      <span className="mono">{enrollment.current ? enrollment.current.paceNumber : '—'}</span>
      {enrollment.otherActive.length ? <span className={styles.cellExtra}>+{enrollment.otherActive.length}</span> : null}
    </button>
  )
}

export function ProgressMatrix({ overview }: { overview: HouseholdOverviewDTO }) {
  const { subjects, students, today } = overview
  const usedSubjects = subjects.filter((subject) =>
    students.some((s) => s.enrollments.some((e) => e.subjectId === subject.id))
  )
  // Full subject names while they fit; abbreviate only for wide curricula.
  const headerName = (name: string) => (usedSubjects.length > 7 ? subjectShortName(name) : name)

  return (
    <Panel
      title="Progress chart"
      meta="Current PACE in every subject — select one to log progress"
      flush
      actions={
        <Link href="/students" className={styles.panelLink}>
          All students <ArrowRight aria-hidden strokeWidth={1.75} />
        </Link>
      }
    >
      <div className={styles.matrixScroll}>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th scope="col" className={styles.studentCol}>
                Student
              </th>
              {usedSubjects.map((subject) => (
                <th scope="col" key={subject.id} title={subject.name} className={styles.subjectCol}>
                  {headerName(subject.name)}
                </th>
              ))}
              <th scope="col" className={styles.numCol}>
                This week
              </th>
              <th scope="col" className={styles.activityCol}>
                Last activity
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <th scope="row" className={styles.studentCell}>
                  <Link href={`/students/${student.id}`} className={styles.studentLink}>
                    <Avatar initials={student.initials} seed={student.id} size="md" />
                    <span className={styles.studentText}>
                      <span className={styles.studentName}>{student.firstName}</span>
                      <StudentStatusLabel status={student.status} />
                    </span>
                  </Link>
                </th>
                {usedSubjects.map((subject) => {
                  const enrollment = student.enrollments.find((e) => e.subjectId === subject.id)
                  return (
                    <td key={subject.id} className={styles.cellTd}>
                      {enrollment ? (
                        <Cell student={student} enrollment={enrollment} />
                      ) : (
                        <span className={styles.notTaking} aria-label={`${student.firstName} doesn’t take ${subject.name}`}>
                          ·
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className={cx(styles.numCol, 'tabular', !student.completedThisWeek && styles.muted)}>
                  {student.completedThisWeek || '—'}
                </td>
                <td className={cx(styles.activityCol, styles.muted)}>
                  {student.lastActivity ? formatRelativeDay(student.lastActivity.occurredOn, today) : 'No activity'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: one row per child with tappable subject chips. */}
      <ul className={styles.matrixList}>
        {students.map((student) => (
          <li key={student.id} className={styles.matrixListItem}>
            <Link href={`/students/${student.id}`} className={styles.studentLink}>
              <Avatar initials={student.initials} seed={student.id} size="md" />
              <span className={styles.studentText}>
                <span className={styles.studentName}>{student.firstName}</span>
                <StudentStatusLabel status={student.status} />
              </span>
              <span className={cx(styles.listWeek, 'tabular')}>
                {student.completedThisWeek ? `${student.completedThisWeek} this week` : ''}
              </span>
            </Link>
            <div className={styles.chips}>
              {student.enrollments.map((enrollment) => (
                <ChipCell key={enrollment.enrollmentId} student={student} enrollment={enrollment} />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.legend} aria-hidden>
        <span>
          <span className={styles.markSignal} /> Completed this week
        </span>
        <span>
          <span className={styles.markWarning} /> Needs attention
        </span>
        <span>— Nothing in progress</span>
      </div>
    </Panel>
  )
}

function ChipCell({ student, enrollment }: { student: StudentOverviewDTO; enrollment: EnrollmentDTO }) {
  const openLog = useLogProgress()
  const concern = enrollment.signals.find(isConcern)
  const next = enrollment.signals.find((s) => s.kind === 'no_active')
  return (
    <button
      type="button"
      className={styles.chip}
      aria-label={cellLabel(student, enrollment)}
      onClick={() =>
        openLog({
          studentId: student.id,
          subjectId: enrollment.subjectId,
          paceNumber: enrollment.current?.paceNumber ?? (next?.kind === 'no_active' ? (next.nextPace ?? undefined) : undefined),
          status: enrollment.current ? 'completed' : 'active'
        })
      }
    >
      {concern ? <span className={styles.markWarning} aria-hidden /> : enrollment.completedThisWeek ? <span className={styles.markSignal} aria-hidden /> : null}
      <span className={styles.chipSubject}>{subjectShortName(enrollment.subjectName)}</span>
      <span className="mono">{enrollment.current?.paceNumber ?? '—'}</span>
    </button>
  )
}
