'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Check, CornerDownLeft, NotebookPen, Play } from 'lucide-react'
import { logProgress, startPace, type LoggedProgress } from '@/app/actions/progress'
import { useAppData } from '@/components/providers/AppData'
import { Button } from '@/components/ui/Button'
import { ChoiceGroup } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Avatar, Kbd } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import { addDays, formatShortDate, type IsoDate } from '@/domain/dates'
import type { RosterStudentDTO } from '@/domain/dto'
import { paceLevel, PACE_STATUS_LABEL, type PaceStatus } from '@/domain/pace'
import { cx } from '@/lib/cx'
import type { LogPrefill } from './LogProgressProvider'
import styles from './LogProgress.module.css'

type RosterSubject = RosterStudentDTO['subjects'][number]

function defaultPaceFor(subject: RosterSubject | null): string {
  if (!subject) return ''
  if (subject.current) return String(subject.current.paceNumber)
  if (subject.lastCompleted) return String(subject.lastCompleted.paceNumber + 1)
  return ''
}

function defaultStatusFor(subject: RosterSubject | null, pace: string): PaceStatus {
  // A subject with nothing in progress is usually being started, not finished.
  if (subject && !subject.current && subject.lastCompleted && Number(pace) === subject.lastCompleted.paceNumber + 1) {
    return 'active'
  }
  return 'completed'
}

const STATUS_OPTIONS: Array<{ value: PaceStatus; label: string }> = [
  { value: 'completed', label: 'Completed' },
  { value: 'active', label: 'Active' },
  { value: 'not_started', label: 'Not started' }
]

export function LogProgressDialog({
  open,
  prefill,
  onClose
}: {
  open: boolean
  prefill: LogPrefill
  onClose: () => void
}) {
  const { roster, household, today } = useAppData()
  const toast = useToast()

  const initialStudent = prefill.studentId ?? (roster.length === 1 ? roster[0].id : null)
  const initialSubject =
    roster.find((s) => s.id === initialStudent)?.subjects.find((s) => s.subjectId === prefill.subjectId) ?? null
  const initialPace = prefill.paceNumber ? String(prefill.paceNumber) : defaultPaceFor(initialSubject)

  const [studentId, setStudentId] = useState<string | null>(initialStudent)
  const [subjectId, setSubjectId] = useState<string | null>(initialSubject?.subjectId ?? null)
  const [pace, setPace] = useState(initialPace)
  const [status, setStatus] = useState<PaceStatus>(prefill.status ?? defaultStatusFor(initialSubject, initialPace))
  const [score, setScore] = useState('')
  const [date, setDate] = useState<IsoDate>(today)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<LoggedProgress | null>(null)
  const [pending, startTransition] = useTransition()
  const [starting, startStarting] = useTransition()

  const scoreRef = useRef<HTMLInputElement>(null)
  const paceRef = useRef<HTMLInputElement>(null)

  const student = roster.find((s) => s.id === studentId) ?? null
  const subject = student?.subjects.find((s) => s.subjectId === subjectId) ?? null
  const paceNumber = /^\d{1,4}$/.test(pace) ? Number(pace) : null
  const scoreNumber = score === '' ? null : Number(score)
  const level = paceNumber ? paceLevel(paceNumber) : null

  function chooseStudent(id: string) {
    setStudentId(id)
    setErrors({})
    const next = roster.find((s) => s.id === id)
    const keep = next?.subjects.find((s) => s.subjectId === subjectId) ?? null
    if (!keep) {
      setSubjectId(null)
      setPace('')
    } else {
      chooseSubject(keep)
    }
  }

  function chooseSubject(next: RosterSubject) {
    setSubjectId(next.subjectId)
    setErrors({})
    const nextPace = defaultPaceFor(next)
    setPace(nextPace)
    const nextStatus = defaultStatusFor(next, nextPace)
    setStatus(nextStatus)
    // Straight to the score: the most common entry is "completed, scored N".
    requestAnimationFrame(() => (nextStatus === 'completed' ? scoreRef.current : paceRef.current)?.focus())
  }

  const recordContext = (() => {
    if (!subject || !paceNumber) return null
    if (subject.current?.paceNumber === paceNumber) {
      return {
        tone: 'neutral' as const,
        text: subject.current.startedOn
          ? `Active since ${formatShortDate(subject.current.startedOn, today)}`
          : 'Active · start date not recorded'
      }
    }
    if (subject.lastCompleted?.paceNumber === paceNumber) {
      const scoreText = subject.lastCompleted.testScore !== null ? ` · ${subject.lastCompleted.testScore}%` : ''
      return {
        tone: 'warning' as const,
        text: `Already completed ${formatShortDate(subject.lastCompleted.completedOn, today)}${scoreText} — saving updates that record`
      }
    }
    return { tone: 'neutral' as const, text: 'New record' }
  })()

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!student) next.studentId = 'Choose a student.'
    else if (!subject) next.subjectId = 'Choose a subject.'
    if (!paceNumber || paceNumber < 1) next.paceNumber = 'Enter the PACE number.'
    if (status === 'completed' && score !== '' && (!Number.isInteger(scoreNumber) || scoreNumber! < 0 || scoreNumber! > 100)) {
      next.testScore = 'Scores run from 0 to 100.'
    }
    if (status !== 'not_started' && (!date || date > today)) next.date = 'Choose a date that isn’t in the future.'
    return next
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    startTransition(async () => {
      const response = await logProgress({
        studentId: student!.id,
        subjectId: subject!.subjectId,
        paceNumber: paceNumber!,
        status,
        testScore: status === 'completed' ? scoreNumber : null,
        date: status === 'not_started' ? null : date,
        notes: showNotes ? notes : undefined
      })
      if (response.ok) {
        setSaved(response.data)
      } else {
        setErrors({ [response.field ?? '_form']: response.error })
      }
    })
  }

  function logAnother() {
    setSaved(null)
    setSubjectId(null)
    setPace('')
    setScore('')
    setNotes('')
    setShowNotes(false)
    setStatus('completed')
    setDate(today)
  }

  function startNext() {
    if (!saved?.nextPace) return
    const next = saved.nextPace
    startStarting(async () => {
      const response = await startPace({ studentId: saved.studentId, subjectId: saved.subjectId, paceNumber: next })
      if (response.ok) {
        toast({ title: `${saved.subjectName} ${next} started`, description: `${saved.studentName}’s current PACE is now ${next}.` })
        onClose()
      } else {
        toast({ title: 'Couldn’t start the next PACE', description: response.error, tone: 'error' })
      }
    })
  }

  if (saved) {
    const verb =
      saved.status === 'completed' ? 'completed' : saved.status === 'active' ? 'started' : 'marked not started'
    return (
      <Dialog open={open} onClose={onClose} title="Progress saved" size="md" locked={starting}>
        <div className={styles.saved} role="status">
          <span className={styles.savedMark} aria-hidden>
            <Check strokeWidth={2.25} />
          </span>
          <div className={styles.savedText}>
            <p className={styles.savedTitle}>
              {saved.subjectName} <span className="mono">{saved.paceNumber}</span> {verb}
              {saved.testScore !== null ? (
                <>
                  {' '}
                  · <span className={cx('tabular', saved.testScore < household.passMark && styles.belowPass)}>{saved.testScore}%</span>
                </>
              ) : null}
            </p>
            <p className={styles.savedMeta}>
              {saved.studentName} · {saved.changed ? 'Dashboard, profile and records are updated.' : 'Nothing changed — the record already matched.'}
            </p>
          </div>
        </div>
        {saved.nextPace ? (
          <div className={styles.nextPace}>
            <p>
              Next up in {saved.subjectName}: <span className="mono">{saved.nextPace}</span>
            </p>
            <Button variant="primary" icon={Play} onClick={startNext} loading={starting} autoFocus>
              Start {saved.nextPace}
            </Button>
          </div>
        ) : null}
        <div className={styles.savedActions}>
          <Button variant="secondary" onClick={logAnother} disabled={starting} autoFocus={!saved.nextPace}>
            Log another for {saved.studentName}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={starting}>
            Done
          </Button>
        </div>
      </Dialog>
    )
  }

  const useChips = roster.length <= 8

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log progress"
      size="md"
      fullOnMobile
      locked={pending}
      footerStart={
        <span className={styles.hint}>
          <Kbd>
            <CornerDownLeft size={11} strokeWidth={2} aria-hidden />
          </Kbd>{' '}
          to save
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="log-progress-form" loading={pending}>
            Save progress
          </Button>
        </>
      }
    >
      <form id="log-progress-form" className={styles.form} onSubmit={onSubmit} noValidate>
        {errors._form ? (
          <div className={styles.formError} role="alert">
            {errors._form}
          </div>
        ) : null}

        <div className={styles.group}>
          <span className={styles.groupLabel} id="log-student-label">
            Student
          </span>
          {useChips ? (
            <ChoiceGroup
              label="Student"
              value={studentId}
              onChange={chooseStudent}
              options={roster.map((s) => ({
                value: s.id,
                label: (
                  <span className={styles.studentChip}>
                    <Avatar initials={s.initials} seed={s.id} size="xs" />
                    {s.firstName}
                  </span>
                ),
                ariaLabel: s.displayName
              }))}
            />
          ) : (
            <Select aria-labelledby="log-student-label" value={studentId ?? ''} onChange={(e) => chooseStudent(e.target.value)}>
              <option value="" disabled>
                Choose a student
              </option>
              {roster.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </Select>
          )}
          {errors.studentId ? <p className={styles.error}>{errors.studentId}</p> : null}
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Subject</span>
          {student ? (
            student.subjects.length ? (
              <ChoiceGroup
                label="Subject"
                value={subjectId}
                onChange={(id) => {
                  const next = student.subjects.find((s) => s.subjectId === id)
                  if (next) chooseSubject(next)
                }}
                options={student.subjects.map((s) => ({
                  value: s.subjectId,
                  label: s.subjectName,
                  meta: s.current ? s.current.paceNumber : '—'
                }))}
              />
            ) : (
              <p className={styles.placeholder}>{student.firstName} has no subjects yet. Add one from their profile.</p>
            )
          ) : (
            <p className={styles.placeholder}>Choose a student first.</p>
          )}
          {errors.subjectId ? <p className={styles.error}>{errors.subjectId}</p> : null}
        </div>

        <div className={styles.row}>
          <Field
            label="PACE"
            error={errors.paceNumber}
            className={styles.paceField}
            aside={level ? `Level ${level}` : undefined}
          >
            {(p) => (
              <Input
                {...p}
                ref={paceRef}
                data-autofocus={initialSubject && status !== 'completed' ? true : undefined}
                className="mono"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 1084"
                value={pace}
                maxLength={4}
                onChange={(e) => setPace(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            )}
          </Field>
          <div className={styles.group}>
            <span className={styles.groupLabel}>Status</span>
            <ChoiceGroup
              label="Status"
              variant="segmented"
              block
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>
        {recordContext ? (
          <p className={cx(styles.context, recordContext.tone === 'warning' && styles.contextWarning)}>{recordContext.text}</p>
        ) : null}

        <div className={styles.row}>
          {status === 'completed' ? (
            <Field
              label="Test score"
              error={errors.testScore}
              hint={
                scoreNumber !== null && scoreNumber < household.passMark && score !== ''
                  ? `Below the ${household.passMark}% pass mark — it will be flagged for review.`
                  : `Pass mark ${household.passMark}%. Leave blank if there’s no score.`
              }
            >
              {(p) => (
                <Input
                  {...p}
                  ref={scoreRef}
                  data-autofocus={initialSubject ? true : undefined}
                  inputMode="numeric"
                  autoComplete="off"
                  numeric
                  suffix="%"
                  value={score}
                  maxLength={3}
                  onChange={(e) => setScore(e.target.value.replace(/\D/g, '').slice(0, 3))}
                />
              )}
            </Field>
          ) : (
            <div />
          )}
          {status !== 'not_started' ? (
            <Field
              label={status === 'completed' ? 'Completed on' : 'Started on'}
              error={errors.date}
              aside={
                <span className={styles.quickDates}>
                  <button type="button" className={cx(date === today && styles.quickActive)} onClick={() => setDate(today)}>
                    Today
                  </button>
                  <button
                    type="button"
                    className={cx(date === addDays(today, -1) && styles.quickActive)}
                    onClick={() => setDate(addDays(today, -1))}
                  >
                    Yesterday
                  </button>
                </span>
              }
            >
              {(p) => <Input {...p} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}
            </Field>
          ) : null}
        </div>

        {showNotes ? (
          <Field label="Notes" optional>
            {(p) => (
              <Textarea
                {...p}
                value={notes}
                rows={3}
                maxLength={2000}
                placeholder="Anything worth remembering — retest planned, struggled with fractions…"
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
                }}
              />
            )}
          </Field>
        ) : (
          <button type="button" className={styles.addNote} onClick={() => setShowNotes(true)}>
            <NotebookPen aria-hidden strokeWidth={1.75} />
            Add a note
          </button>
        )}
        <span className="visually-hidden" aria-live="polite">
          {student && subject ? `${student.firstName}, ${subject.subjectName}, ${PACE_STATUS_LABEL[status]}` : ''}
        </span>
      </form>
    </Dialog>
  )
}
