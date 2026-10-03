'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { Archive, ArchiveRestore, ArrowLeft, Ellipsis, MessageSquareText, Pencil, Plus, Trash, TriangleAlert } from 'lucide-react'
import { addSubjectToStudent, archiveStudent, deleteStudent, editStudent, removeSubjectFromStudent } from '@/app/actions/students'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Menu } from '@/components/ui/Menu'
import { Avatar, Badge, EmptyState, Panel, SectionHeading, StudentStatusLabel } from '@/components/ui/Misc'
import { tableStyles } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { formatTableDate } from '@/domain/dates'
import type { ActivityDTO, EnrollmentDTO, RecordDTO, StudentOverviewDTO, SubjectDTO } from '@/domain/dto'
import { describeSignal } from '@/domain/health'
import { plural } from '@/domain/format'
import { paceLevel, PACE_STATUS_LABEL } from '@/domain/pace'
import { cx } from '@/lib/cx'
import { PaceStrip } from './PaceStrip'
import { RecordList } from '@/components/records/RecordList'
import styles from './Profile.module.css'

const HISTORY_PREVIEW = 12

interface ProfileProps {
  student: StudentOverviewDTO
  records: RecordDTO[]
  activity: ActivityDTO[]
  today: string
  passMark: number
  archived: boolean
  highlightSubject: string | null
  availableSubjects: SubjectDTO[]
}

export function StudentProfile({ student, records, activity, today, passMark, archived, highlightSubject, availableSubjects }: ProfileProps) {
  const router = useRouter()
  const openLog = useLogProgress()
  const toast = useToast()
  const [dialog, setDialog] = useState<null | 'edit' | 'archive' | 'delete' | 'add-subject' | { remove: EnrollmentDTO }>(null)
  const [pending, startTransition] = useTransition()
  const [historySubject, setHistorySubject] = useState<string>('all')
  const [showAllHistory, setShowAllHistory] = useState(false)

  // "Show me Sarah's Science progress" lands here with ?subject= — bring it into view.
  useEffect(() => {
    if (!highlightSubject) return
    document.getElementById(`subject-${highlightSubject}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightSubject])

  const totalCompleted = student.enrollments.reduce((sum, e) => sum + e.completedTotal, 0)
  const recordsByEnrollment = new Map<string, RecordDTO[]>()
  for (const record of records) {
    const list = recordsByEnrollment.get(record.enrollmentId) ?? []
    list.push(record)
    recordsByEnrollment.set(record.enrollmentId, list)
  }
  const history = [...records]
    .filter((r) => historySubject === 'all' || r.subjectId === historySubject)
    .sort((a, b) => {
      const da = a.completedOn ?? a.startedOn ?? a.createdAt.slice(0, 10)
      const dbb = b.completedOn ?? b.startedOn ?? b.createdAt.slice(0, 10)
      return da === dbb ? b.paceNumber - a.paceNumber : da < dbb ? 1 : -1
    })
  const historySubjects = [...new Map(records.map((r) => [r.subjectId, r.subjectName])).entries()]

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast({ title: success })
        setDialog(null)
        after?.()
      } else {
        toast({ title: 'That didn’t work', description: 'error' in result ? result.error : undefined, tone: 'error' })
      }
    })
  }

  return (
    <div className={styles.page}>
      <Link href="/students" className={styles.back}>
        <ArrowLeft aria-hidden strokeWidth={1.75} /> Students
      </Link>

      <header className={styles.header}>
        <Avatar initials={student.initials} seed={student.id} size="xl" />
        <div className={styles.identity}>
          <h1 className={styles.name}>{student.displayName}</h1>
          <div className={styles.meta}>
            {student.level ? <span>Level {student.level}</span> : null}
            <StudentStatusLabel status={student.status} />
            {archived ? <Badge>Archived</Badge> : null}
          </div>
        </div>
        <div className={styles.actions}>
          {!archived ? (
            <Button variant="primary" icon={Plus} onClick={() => openLog({ studentId: student.id })}>
              Log progress
            </Button>
          ) : null}
          <Button variant="secondary" icon={Pencil} onClick={() => setDialog('edit')}>
            Edit
          </Button>
          <Menu
            label="More actions"
            align="end"
            items={[
              ...(!archived ? [{ label: 'Add subject', icon: Plus, onSelect: () => setDialog('add-subject') }] : []),
              archived
                ? { label: 'Restore student', icon: ArchiveRestore, onSelect: () => run(() => archiveStudent(student.id, false), `${student.firstName} restored`) }
                : { label: 'Archive student', icon: Archive, onSelect: () => setDialog('archive') },
              ...(records.length === 0
                ? [{ label: 'Delete student', icon: Trash, danger: true, separatorBefore: true, onSelect: () => setDialog('delete') }]
                : [])
            ]}
            trigger={(props) => (
              <Button variant="ghost" iconOnly icon={Ellipsis} aria-label="More actions" {...props} />
            )}
          />
        </div>
      </header>

      <dl className={styles.stats}>
        <div>
          <dt>Subjects</dt>
          <dd>{student.enrollments.length}</dd>
        </div>
        <div>
          <dt>PACEs completed</dt>
          <dd>{totalCompleted}</dd>
          <dd className={styles.statMeta}>{student.completedThisYear} this school year</dd>
        </div>
        <div>
          <dt>Average test score</dt>
          <dd className={cx(student.averageScore !== null && student.averageScore < passMark && styles.danger)}>
            {student.averageScore !== null ? `${student.averageScore}%` : '—'}
          </dd>
          <dd className={styles.statMeta}>this school year</dd>
        </div>
        <div>
          <dt>Completed this week</dt>
          <dd>{student.completedThisWeek}</dd>
          <dd className={styles.statMeta}>{student.completedLastWeek} last week</dd>
        </div>
      </dl>

      {student.concerns.length ? (
        <section className={styles.concerns} aria-label="Needs attention">
          {student.concerns.map((concern) => (
            <p key={`${concern.subjectId}-${concern.signal.kind}`} className={styles.concern}>
              <TriangleAlert aria-hidden strokeWidth={2} />
              {describeSignal(concern.signal, concern.subjectName)}
            </p>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="subjects-title">
        <SectionHeading title={<span id="subjects-title">Subjects</span>} meta="Select a PACE to inspect it, or an empty slot to add a past result" />
        {student.enrollments.length === 0 ? (
          <Panel>
            <EmptyState
              compact
              icon={Plus}
              title="No subjects yet"
              actions={!archived ? <Button onClick={() => setDialog('add-subject')}>Add subject</Button> : null}
            >
              Add the subjects {student.firstName} is working through to start tracking PACEs.
            </EmptyState>
          </Panel>
        ) : (
          <div className={styles.subjects}>
            {student.enrollments.map((enrollment) => {
              const subjectRecords = recordsByEnrollment.get(enrollment.enrollmentId) ?? []
              const level = enrollment.current ? paceLevel(enrollment.current.paceNumber) : null
              return (
                <article
                  key={enrollment.enrollmentId}
                  id={`subject-${enrollment.subjectId}`}
                  className={cx(styles.subject, highlightSubject === enrollment.subjectId && styles.subjectHighlight)}
                >
                  <div className={styles.subjectHead}>
                    <h3 className={styles.subjectName}>{enrollment.subjectName}</h3>
                    <dl className={styles.subjectStats}>
                      <div>
                        <dt>Current</dt>
                        <dd className="mono">{enrollment.current?.paceNumber ?? '—'}</dd>
                      </div>
                      {level ? (
                        <div>
                          <dt>Level</dt>
                          <dd className="tabular">{level}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Last score</dt>
                        <dd className={cx('tabular', enrollment.lastCompleted?.testScore != null && enrollment.lastCompleted.testScore < passMark && styles.danger)}>
                          {enrollment.lastCompleted?.testScore != null ? `${enrollment.lastCompleted.testScore}%` : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Average</dt>
                        <dd className="tabular">{enrollment.averageScore !== null ? `${enrollment.averageScore}%` : '—'}</dd>
                      </div>
                      <div>
                        <dt>Completed</dt>
                        <dd className="tabular">{enrollment.completedTotal}</dd>
                      </div>
                    </dl>
                    {!archived ? (
                      <div className={styles.subjectActions}>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Plus}
                          onClick={() =>
                            openLog({
                              studentId: student.id,
                              subjectId: enrollment.subjectId,
                              paceNumber: enrollment.current?.paceNumber,
                              status: enrollment.current ? 'completed' : 'active'
                            })
                          }
                        >
                          Log
                        </Button>
                        <Menu
                          label={`${enrollment.subjectName} actions`}
                          align="end"
                          items={[{ label: 'Stop tracking subject', icon: Archive, onSelect: () => setDialog({ remove: enrollment }) }]}
                          trigger={(props) => (
                            <Button size="sm" variant="ghost" iconOnly icon={Ellipsis} aria-label={`${enrollment.subjectName} actions`} {...props} />
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                  <PaceStrip studentId={student.id} enrollment={enrollment} records={subjectRecords} passMark={passMark} today={today} />
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className={styles.lower}>
        <section aria-labelledby="history-title" className={styles.history}>
          <div className={styles.historyHead}>
            <SectionHeading title={<span id="history-title">History</span>} meta={plural(history.length, 'record')} />
            {historySubjects.length > 1 ? (
              <Select aria-label="Filter history by subject" value={historySubject} onChange={(e) => setHistorySubject(e.target.value)} className={styles.historyFilter}>
                <option value="all">All subjects</option>
                {historySubjects.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <Panel flush>
            {history.length === 0 ? (
              <EmptyState compact icon={MessageSquareText} title="No records yet">
                Logged PACEs and test scores for {student.firstName} will be listed here.
              </EmptyState>
            ) : (
              <>
                <HistoryTable records={showAllHistory ? history : history.slice(0, HISTORY_PREVIEW)} passMark={passMark} today={today} />
                {history.length > HISTORY_PREVIEW ? (
                  <button type="button" className={styles.showAll} onClick={() => setShowAllHistory((v) => !v)} aria-expanded={showAllHistory}>
                    {showAllHistory ? 'Show recent only' : `Show all ${history.length} records`}
                  </button>
                ) : null}
              </>
            )}
          </Panel>
        </section>
        <aside className={styles.activity}>
          <ActivityFeed items={activity} today={today} title="Activity" />
        </aside>
      </div>

      <EditStudentDialog open={dialog === 'edit'} student={student} onClose={() => setDialog(null)} />
      <AddSubjectDialog
        open={dialog === 'add-subject'}
        studentId={student.id}
        studentName={student.firstName}
        subjects={availableSubjects}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'archive'}
        title={`Archive ${student.firstName}?`}
        description={`${student.firstName} will be hidden from the dashboard and lists. Every record stays in their history and in reports, and you can restore them any time.`}
        confirmLabel="Archive student"
        pending={pending}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => archiveStudent(student.id, true), `${student.firstName} archived`, () => router.push('/students'))}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${student.firstName}?`}
        description={`${student.firstName} has no records yet, so they can be deleted permanently. This can’t be undone.`}
        confirmLabel="Delete student"
        pending={pending}
        onClose={() => setDialog(null)}
        onConfirm={() => run(() => deleteStudent(student.id), `${student.firstName} deleted`, () => router.push('/students'))}
      />
      <ConfirmDialog
        open={typeof dialog === 'object' && dialog !== null}
        title={typeof dialog === 'object' && dialog ? `Stop tracking ${dialog.remove.subjectName}?` : ''}
        description={
          typeof dialog === 'object' && dialog
            ? `${dialog.remove.subjectName} will be removed from ${student.firstName}’s current subjects. Its ${plural(dialog.remove.completedTotal, 'completed PACE')} stay in their history and reports.`
            : ''
        }
        confirmLabel="Stop tracking"
        pending={pending}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          if (typeof dialog === 'object' && dialog) {
            const subject = dialog.remove
            run(() => removeSubjectFromStudent(student.id, subject.subjectId), `${subject.subjectName} removed`)
          }
        }}
      />
    </div>
  )
}

export function HistoryTable({ records, passMark, today, showStudent }: { records: RecordDTO[]; passMark: number; today: string; showStudent?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function hrefFor(recordId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('record', recordId)
    return `${pathname}?${params.toString()}`
  }

  return (
    <>
    <RecordList records={records} passMark={passMark} today={today} showStudent={showStudent} />
    <div className={cx(tableStyles.scroll, styles.tableWide)}>
      <table className={cx(tableStyles.table, tableStyles.interactive)}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {showStudent ? <th scope="col">Student</th> : null}
            <th scope="col">Subject</th>
            <th scope="col">PACE</th>
            <th scope="col" className={tableStyles.num}>
              Score
            </th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="visually-hidden">Notes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const date = record.completedOn ?? record.startedOn
            return (
              <tr key={record.id} className={tableStyles.rowLinkRow}>
                <td className={cx(tableStyles.nowrap, tableStyles.secondary, 'tabular')}>
                  <Link
                    href={hrefFor(record.id)}
                    scroll={false}
                    replace
                    className={tableStyles.rowLink}
                    aria-label={`${record.subjectName} ${record.paceNumber}, ${PACE_STATUS_LABEL[record.status]}${record.testScore !== null ? `, ${record.testScore}%` : ''}. Open record.`}
                    onClick={(e) => {
                      e.preventDefault()
                      router.replace(hrefFor(record.id), { scroll: false })
                    }}
                  >
                    {date ? formatTableDate(date, today) : '—'}
                  </Link>
                </td>
                {showStudent ? <td>{record.studentName}</td> : null}
                <td>{record.subjectName}</td>
                <td className="mono">{record.paceNumber}</td>
                <td className={cx(tableStyles.num, record.testScore !== null && record.testScore < passMark && styles.danger, record.testScore === null && tableStyles.muted)}>
                  {record.testScore !== null ? `${record.testScore}%` : '—'}
                </td>
                <td>
                  <StatusText status={record.status} />
                </td>
                <td className={tableStyles.num}>
                  {record.notes ? <MessageSquareText className={styles.noteIcon} aria-label="Has notes" strokeWidth={1.75} /> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}

export function StatusText({ status }: { status: RecordDTO['status'] }) {
  return (
    <span className={cx(styles.status, styles[`status_${status}`])}>
      <span className={styles.statusDot} aria-hidden />
      {PACE_STATUS_LABEL[status]}
    </span>
  )
}

function EditStudentDialog({ open, student, onClose }: { open: boolean; student: StudentOverviewDTO; onClose: () => void }) {
  const toast = useToast()
  const [firstName, setFirstName] = useState(student.firstName)
  const [lastName, setLastName] = useState(student.lastName ?? '')
  const [level, setLevel] = useState(student.level ? String(student.level) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await editStudent(student.id, { firstName, lastName: lastName || null, level: level ? Number(level) : null })
      if (result.ok) {
        toast({ title: 'Student updated' })
        onClose()
      } else {
        setErrors(result.fields ?? { _form: result.error })
      }
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit student"
      size="sm"
      locked={pending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-student-form" loading={pending}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-student-form" className={styles.form} onSubmit={onSubmit} noValidate>
        {errors._form ? <p className={styles.formError}>{errors._form}</p> : null}
        <Field label="First name" error={errors.firstName}>
          {(p) => <Input {...p} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} data-autofocus />}
        </Field>
        <Field label="Last name" optional error={errors.lastName}>
          {(p) => <Input {...p} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={40} />}
        </Field>
        <Field label="Level" optional>
          {(p) => (
            <Select {...p} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">—</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  )
}

function AddSubjectDialog({
  open,
  studentId,
  studentName,
  subjects,
  onClose
}: {
  open: boolean
  studentId: string
  studentName: string
  subjects: SubjectDTO[]
  onClose: () => void
}) {
  const toast = useToast()
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [pace, setPace] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!subjectId) return
    startTransition(async () => {
      const result = await addSubjectToStudent({ studentId, subjectId, currentPace: pace ? Number(pace) : null })
      if (result.ok) {
        toast({ title: `${subjects.find((s) => s.id === subjectId)?.name ?? 'Subject'} added for ${studentName}` })
        setPace('')
        onClose()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add a subject for ${studentName}`}
      size="sm"
      locked={pending}
      footer={
        subjects.length ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="add-subject-form" loading={pending}>
              Add subject
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {subjects.length === 0 ? (
        <p className={styles.formNote}>
          {studentName} already takes every subject in your homeschool. Add new subjects in <Link href="/settings">Settings</Link>.
        </p>
      ) : (
        <form id="add-subject-form" className={styles.form} onSubmit={onSubmit} noValidate>
          {error ? <p className={styles.formError}>{error}</p> : null}
          <Field label="Subject">
            {(p) => (
              <Select {...p} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} data-autofocus>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Current PACE" optional hint="The PACE they’re working on now.">
            {(p) => (
              <Input {...p} className="mono" inputMode="numeric" value={pace} maxLength={4} onChange={(e) => setPace(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            )}
          </Field>
        </form>
      )}
    </Dialog>
  )
}
