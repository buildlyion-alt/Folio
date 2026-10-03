'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Check, NotebookPen, Play, Sparkles } from 'lucide-react'
import { logProgress, startPace, type LoggedProgress } from '@/app/actions/progress'
import { AssistantComposer } from '@/components/assistant/AssistantComposer'
import { useAppData } from '@/components/providers/AppData'
import { Button } from '@/components/ui/Button'
import { ChoiceGroup } from '@/components/ui/Choice'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import { addDays, formatShortDate, type IsoDate } from '@/domain/dates'
import type { RosterStudentDTO } from '@/domain/dto'
import { paceLevel } from '@/domain/pace'
import { cx } from '@/lib/cx'
import type { LogPrefill } from './LogProgressProvider'
import styles from './LogProgress.module.css'

type RosterSubject = RosterStudentDTO['subjects'][number]
/** The two things that happen to a PACE day to day. Resetting one lives in the record editor. */
type Happened = 'completed' | 'active'

const HAPPENED_OPTIONS: Array<{ value: Happened; label: string }> = [
  { value: 'completed', label: 'Completed' },
  { value: 'active', label: 'Started' }
]

function defaultPaceFor(subject: RosterSubject | null): string {
  if (!subject) return ''
  if (subject.current) return String(subject.current.paceNumber)
  if (subject.lastCompleted) return String(subject.lastCompleted.paceNumber + 1)
  return ''
}

function defaultHappenedFor(subject: RosterSubject | null, pace: string): Happened {
  // A subject with nothing in progress is usually being started, not finished.
  if (subject && !subject.current && subject.lastCompleted && Number(pace) === subject.lastCompleted.paceNumber + 1) {
    return 'active'
  }
  return 'completed'
}

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
  const initialHappened: Happened =
    prefill.status === 'active' ? 'active' : prefill.status === 'completed' ? 'completed' : defaultHappenedFor(initialSubject, initialPace)

  const [mode, setMode] = useState<'form' | 'type'>('form')
  const [studentId, setStudentId] = useState<string | null>(initialStudent)
  const [subjectId, setSubjectId] = useState<string | null>(initialSubject?.subjectId ?? null)
  const [pace, setPace] = useState(initialPace)
  const [happened, setHappened] = useState<Happened>(initialHappened)
  const [score, setScore] = useState('')
  const [date, setDate] = useState<IsoDate>(today)
  const [showDate, setShowDate] = useState(false)
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
    const nextHappened = defaultHappenedFor(next, nextPace)
    setHappened(nextHappened)
    // Straight to the score: the most common entry is "completed, scored N".
    requestAnimationFrame(() => (nextHappened === 'completed' ? scoreRef.current : paceRef.current)?.focus())
  }

  // Only say something when saving would surprise: the PACE is already recorded as completed.
  const overwriteWarning = (() => {
    if (!subject || !paceNumber || subject.lastCompleted?.paceNumber !== paceNumber) return null
    const previous = subject.lastCompleted.testScore !== null ? ` with ${subject.lastCompleted.testScore}%` : ''
    return `Already completed ${formatShortDate(subject.lastCompleted.completedOn, today)}${previous}. Saving updates that record.`
  })()

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!student) next.studentId = 'Choose a student.'
    else if (!subject) next.subjectId = 'Choose a subject.'
    if (!paceNumber || paceNumber < 1) next.paceNumber = 'Enter the PACE number.'
    if (happened === 'completed' && score !== '' && (!Number.isInteger(scoreNumber) || scoreNumber! < 0 || scoreNumber! > 100)) {
      next.testScore = 'Scores run from 0 to 100.'
    }
    if (!date || date > today) next.date = 'Choose a date that isn’t in the future.'
    return next
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validate()
    setErrors(found)
    if (found.date) setShowDate(true)
    if (Object.keys(found).length) return
    startTransition(async () => {
      const response = await logProgress({
        studentId: student!.id,
        subjectId: subject!.subjectId,
        paceNumber: paceNumber!,
        status: happened,
        testScore: happened === 'completed' ? scoreNumber : null,
        date,
        notes: showNotes ? notes : undefined
      })
      if (response.ok) {
        setSaved(response.data)
      } else {
        if (response.field === 'date') setShowDate(true)
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
    setHappened('completed')
    setDate(today)
    setShowDate(false)
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
    const verb = saved.status === 'completed' ? 'completed' : saved.status === 'active' ? 'started' : 'marked not started'
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
              {saved.studentName}
              {saved.changed ? '' : ' · nothing changed, the record already matched'}
            </p>
          </div>
        </div>
        {saved.nextPace ? (
          <div className={styles.nextPace}>
            <p>
              Next in {saved.subjectName}: <span className="mono">{saved.nextPace}</span>
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

  if (mode === 'type') {
    return (
      <Dialog open={open} onClose={onClose} title="Log progress" description="Say what happened. You’ll check it before anything is saved." size="md" fullOnMobile>
        <div className={styles.typeMode}>
          <AssistantComposer bare autoFocus placeholder="e.g. “Gabriel finished Math 1084 with 94%”" onSaved={onClose} onNavigated={onClose} />
          <button type="button" className={styles.switchMode} onClick={() => setMode('form')}>
            Use the form instead
          </button>
        </div>
      </Dialog>
    )
  }

  const useChips = roster.length <= 8
  const dateWord = happened === 'completed' ? 'Completed' : 'Started'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log progress"
      size="md"
      fullOnMobile
      locked={pending}
      footerStart={
        <button type="button" className={styles.switchMode} onClick={() => setMode('type')}>
          <Sparkles aria-hidden strokeWidth={1.75} />
          Type it instead
        </button>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="log-progress-form" loading={pending}>
            Save
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
              <p className={styles.placeholder}>{student.firstName} has no subjects yet. Add one from their page.</p>
            )
          ) : (
            <p className={styles.placeholder}>Choose a student first.</p>
          )}
          {errors.subjectId ? <p className={styles.error}>{errors.subjectId}</p> : null}
        </div>

        <div className={styles.row}>
          <Field label="PACE" error={errors.paceNumber} aside={level ? `Level ${level}` : undefined}>
            {(p) => (
              <Input
                {...p}
                ref={paceRef}
                data-autofocus={initialSubject && happened !== 'completed' ? true : undefined}
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
            <span className={styles.groupLabel}>What happened?</span>
            <ChoiceGroup label="What happened?" variant="segmented" block value={happened} onChange={setHappened} options={HAPPENED_OPTIONS} />
          </div>
        </div>
        {overwriteWarning ? <p className={styles.warning}>{overwriteWarning}</p> : null}

        {happened === 'completed' ? (
          <div className={styles.row}>
            <Field
              label="Test score"
              optional
              error={errors.testScore}
              hint={
                scoreNumber !== null && score !== '' && scoreNumber < household.passMark
                  ? `Below the ${household.passMark}% pass mark — it will show as needing a look.`
                  : undefined
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
          </div>
        ) : null}

        {showDate ? (
          <div className={styles.row}>
            <Field
              label={`${dateWord} on`}
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
          </div>
        ) : null}

        {showNotes ? (
          <Field label="Note" optional>
            {(p) => (
              <Textarea
                {...p}
                value={notes}
                rows={3}
                maxLength={2000}
                placeholder="Anything worth remembering — a retest planned, a tricky section…"
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
                }}
              />
            )}
          </Field>
        ) : null}

        {!showDate || !showNotes ? (
          <p className={styles.extras}>
            {!showDate ? (
              <>
                <span>{dateWord} today</span>
                <button type="button" className={styles.inlineLink} onClick={() => setShowDate(true)}>
                  Change date
                </button>
              </>
            ) : null}
            {!showNotes ? (
              <button type="button" className={styles.addNote} onClick={() => setShowNotes(true)}>
                <NotebookPen aria-hidden strokeWidth={1.75} />
                Add a note
              </button>
            ) : null}
          </p>
        ) : null}
        <span className="visually-hidden" aria-live="polite">
          {student && subject ? `${student.firstName}, ${subject.subjectName}, ${happened === 'completed' ? 'completed' : 'started'}` : ''}
        </span>
      </form>
    </Dialog>
  )
}
