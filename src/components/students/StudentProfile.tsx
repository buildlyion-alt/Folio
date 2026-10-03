'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { Archive, ArchiveRestore, ArrowRight, ChevronDown, Ellipsis, Pencil, Plus, Trash } from 'lucide-react'
import { addSubjectToStudent, archiveStudent, deleteStudent, editStudent, removeSubjectFromStudent } from '@/app/actions/students'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { Avatar, Badge, EmptyState, PageHeader, SectionHeading } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import { formatShortDate } from '@/domain/dates'
import type { EnrollmentDTO, RecordDTO, StudentOverviewDTO, SubjectDTO } from '@/domain/dto'
import { describeSignal, isConcern } from '@/domain/health'
import { plural } from '@/domain/format'
import { resultLabel } from '@/domain/pace'
import { cx } from '@/lib/cx'
import styles from './Profile.module.css'

const RECENT_LIMIT = 8
const SUBJECT_RESULTS_LIMIT = 6

interface ProfileProps {
  student: StudentOverviewDTO
  records: RecordDTO[]
  today: string
  passMark: number
  archived: boolean
  highlightSubject: string | null
  availableSubjects: SubjectDTO[]
}

const recordDate = (r: RecordDTO) => r.completedOn ?? r.startedOn ?? r.createdAt.slice(0, 10)

function newestFirst(a: RecordDTO, b: RecordDTO) {
  const [x, y] = [recordDate(a), recordDate(b)]
  return x === y ? b.paceNumber - a.paceNumber : x < y ? 1 : -1
}

export function StudentProfile({ student, records, today, passMark, archived, highlightSubject, availableSubjects }: ProfileProps) {
  const router = useRouter()
  const openLog = useLogProgress()
  const toast = useToast()
  const [dialog, setDialog] = useState<null | 'edit' | 'archive' | 'delete' | 'add-subject' | { remove: EnrollmentDTO }>(null)
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState<Set<string>>(() => new Set(highlightSubject ? [highlightSubject] : []))
  const [shownHighlight, setShownHighlight] = useState(highlightSubject)
  if (highlightSubject !== shownHighlight) {
    setShownHighlight(highlightSubject)
    if (highlightSubject) setOpen((current) => new Set(current).add(highlightSubject))
  }

  // "Show me Sarah's Science progress" lands here with ?subject= — open it and bring it into view.
  useEffect(() => {
    if (!highlightSubject) return
    document.getElementById(`subject-${highlightSubject}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [highlightSubject])

  const recordsByEnrollment = new Map<string, RecordDTO[]>()
  for (const record of records) {
    const list = recordsByEnrollment.get(record.enrollmentId) ?? []
    list.push(record)
    recordsByEnrollment.set(record.enrollmentId, list)
  }
  // Results, newest first; a PACE that was only started shows up as the subject's current PACE instead.
  const completed = records.filter((r) => r.status === 'completed').sort(newestFirst)
  const recent = completed.slice(0, RECENT_LIMIT)

  function toggle(subjectId: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(subjectId)) next.delete(subjectId)
      else next.add(subjectId)
      return next
    })
  }

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

  const moreItems: MenuItem[] = [
    ...(!archived ? [{ label: 'Add a subject', icon: Plus, onSelect: () => setDialog('add-subject') }] : []),
    archived
      ? { label: 'Restore student', icon: ArchiveRestore, onSelect: () => run(() => archiveStudent(student.id, false), `${student.firstName} restored`) }
      : { label: 'Archive student', icon: Archive, onSelect: () => setDialog('archive') },
    ...(records.length === 0 ? [{ label: 'Delete student', icon: Trash, danger: true, separatorBefore: true, onSelect: () => setDialog('delete') }] : [])
  ]

  const summary = [
    student.level ? `Level ${student.level}` : null,
    `${plural(student.completedThisWeek, 'PACE')} completed this week`,
    student.averageScore !== null ? `${student.averageScore}% average score` : null
  ].filter(Boolean)

  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumb={[{ href: '/students', label: 'Students' }]}
        title={
          <span className={styles.titleRow}>
            <Avatar initials={student.initials} seed={student.id} size="lg" />
            {student.displayName}
            {archived ? <Badge>Archived</Badge> : null}
          </span>
        }
        description={summary.join(' · ')}
        actions={
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setDialog('edit')}>
              Edit
            </Button>
            <Menu
              label="More actions"
              align="end"
              items={moreItems}
              trigger={(props) => <Button variant="ghost" iconOnly icon={Ellipsis} aria-label="More actions" {...props} />}
            />
          </>
        }
      />

      {student.concerns.length ? (
        <ul className={styles.concerns} aria-label="Needs a look">
          {student.concerns.map((concern) => (
            <li key={`${concern.subjectId}-${concern.signal.kind}`}>
              <span className={styles.flag} aria-hidden />
              {describeSignal(concern.signal, concern.subjectName)}
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="subjects-title" className={styles.section}>
        <SectionHeading title={<span id="subjects-title">Subjects</span>} />
        {student.enrollments.length === 0 ? (
          <div className={styles.surface}>
            <EmptyState
              compact
              icon={Plus}
              title="No subjects yet"
              actions={!archived ? <Button onClick={() => setDialog('add-subject')}>Add a subject</Button> : null}
            >
              Add the subjects {student.firstName} is working through to start keeping PACE records.
            </EmptyState>
          </div>
        ) : (
          <div className={styles.surface}>
            <div className={styles.subjectColumns} aria-hidden>
              <span>Subject</span>
              <span>Current PACE</span>
              <span>Last score</span>
              <span />
            </div>
            {student.enrollments.map((enrollment) => {
              const isOpen = open.has(enrollment.subjectId)
              const last = enrollment.lastCompleted
              const concern = enrollment.signals.some(isConcern)
              const subjectRecords = recordsByEnrollment.get(enrollment.enrollmentId) ?? []
              return (
                <div key={enrollment.enrollmentId} id={`subject-${enrollment.subjectId}`} className={cx(styles.subject, isOpen && styles.subjectOpen)}>
                  <button
                    type="button"
                    className={styles.subjectRow}
                    aria-expanded={isOpen}
                    aria-controls={`subject-detail-${enrollment.subjectId}`}
                    onClick={() => toggle(enrollment.subjectId)}
                  >
                    <span className={styles.subjectName}>{enrollment.subjectName}</span>
                    <span className={styles.subjectCurrent}>
                      <span className="visually-hidden">, current PACE </span>
                      <span className={cx('mono', !enrollment.current && styles.muted)}>{enrollment.current?.paceNumber ?? '—'}</span>
                      {concern ? (
                        <>
                          <span className={styles.flag} aria-hidden />
                          <span className="visually-hidden">, needs a look</span>
                        </>
                      ) : null}
                    </span>
                    <span className={cx(styles.subjectScore, 'tabular', last?.testScore != null && last.testScore < passMark && styles.danger, last?.testScore == null && styles.muted)}>
                      <span className="visually-hidden">, last score </span>
                      {last?.testScore != null ? `${last.testScore}%` : '—'}
                    </span>
                    <ChevronDown className={styles.chevron} aria-hidden strokeWidth={1.75} />
                  </button>
                  {isOpen ? (
                    <div id={`subject-detail-${enrollment.subjectId}`} className={styles.detail}>
                      {subjectRecords.length ? (
                        <>
                          <p className={styles.detailMeta}>
                            {[
                              `${plural(enrollment.completedThisYear, 'PACE')} completed this year`,
                              enrollment.averageScore !== null ? `${enrollment.averageScore}% average` : null,
                              enrollment.otherActive.length ? `also working on ${enrollment.otherActive.join(', ')}` : null
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <RecordRows records={[...subjectRecords].sort(newestFirst).slice(0, SUBJECT_RESULTS_LIMIT)} passMark={passMark} today={today} />
                        </>
                      ) : (
                        <p className={styles.detailMeta}>No {enrollment.subjectName} records yet.</p>
                      )}
                      <div className={styles.detailActions}>
                        {!archived ? (
                          <Button
                            size="sm"
                            variant="secondary"
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
                            Log {enrollment.subjectName}
                          </Button>
                        ) : null}
                        {subjectRecords.length > SUBJECT_RESULTS_LIMIT ? (
                          <Link href={`/records?student=${student.id}&subject=${enrollment.subjectId}`} className={styles.textLink}>
                            All {plural(subjectRecords.length, `${enrollment.subjectName} record`)} <ArrowRight aria-hidden strokeWidth={1.75} />
                          </Link>
                        ) : null}
                        {!archived ? (
                          <button type="button" className={styles.quietAction} onClick={() => setDialog({ remove: enrollment })}>
                            Stop tracking
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="recent-title" className={styles.section}>
        <SectionHeading title={<span id="recent-title">Recent activity</span>} />
        {recent.length === 0 ? (
          <p className={styles.empty}>Completed PACEs and test scores for {student.firstName} will appear here.</p>
        ) : (
          <div className={styles.surface}>
            <RecordRows records={recent} passMark={passMark} today={today} showSubject />
          </div>
        )}
        {completed.length > RECENT_LIMIT ? (
          <Link href={`/records?student=${student.id}`} className={styles.textLink}>
            All of {student.firstName}’s records <ArrowRight aria-hidden strokeWidth={1.75} />
          </Link>
        ) : null}
      </section>

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
        description={`${student.firstName} will be hidden from Home and lists. Every record stays in their history and in reports, and you can restore them any time.`}
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

/** Compact result rows: subject, PACE, result, date. Each opens the record. */
function RecordRows({ records, passMark, today, showSubject }: { records: RecordDTO[]; passMark: number; today: string; showSubject?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  function hrefFor(recordId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('record', recordId)
    return `${pathname}?${params.toString()}`
  }
  return (
    <ul className={cx(styles.records, showSubject && styles.recordsWithSubject)}>
      {records.map((record) => {
        const date = recordDate(record)
        const result = resultLabel(record.status, record.testScore)
        return (
          <li key={record.id}>
            <Link
              href={hrefFor(record.id)}
              scroll={false}
              replace
              className={styles.recordRow}
              aria-label={`${record.subjectName} ${record.paceNumber}, ${result}, ${formatShortDate(date, today)}. Open record.`}
            >
              {showSubject ? <span className={styles.recordSubject}>{record.subjectName}</span> : null}
              <span className={cx('mono', styles.recordPace)}>{record.paceNumber}</span>
              <span
                className={cx(
                  styles.recordResult,
                  record.status !== 'completed' && styles.muted,
                  record.testScore !== null && record.testScore < passMark && styles.danger
                )}
              >
                {result}
              </span>
              <span className={styles.recordDate}>{formatShortDate(date, today)}</span>
            </Link>
          </li>
        )
      })}
    </ul>
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
          <Button variant="ink" type="submit" form="edit-student-form" loading={pending}>
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
            <Button variant="ink" type="submit" form="add-subject-form" loading={pending}>
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
