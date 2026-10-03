'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { Pencil, Trash } from 'lucide-react'
import { deleteRecord, getRecordDetail, updateRecord, type RecordDetail } from '@/app/actions/progress'
import { StatusText } from '@/components/records/StatusText'
import { Button } from '@/components/ui/Button'
import { ChoiceGroup } from '@/components/ui/Choice'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import { formatLongDate, formatShortDate, todayIn } from '@/domain/dates'
import { useAppData } from '@/components/providers/AppData'
import type { ActivityDTO } from '@/domain/dto'
import { PACE_STATUS_LABEL, paceLevel, type PaceStatus } from '@/domain/pace'
import { cx } from '@/lib/cx'
import styles from './Records.module.css'

/** Opens whenever the URL carries ?record=<id>, on any page. */
export function RecordDialogHost() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const recordId = searchParams.get('record')
  if (!recordId) return null

  function close() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('record')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return <RecordDialog key={recordId} recordId={recordId} onClose={close} />
}

const SOURCE_LABEL: Record<ActivityDTO['source'], string> = {
  manual: 'Logged',
  assistant: 'Logged via assistant',
  onboarding: 'Set during setup',
  demo: 'Demo data'
}

const KIND_LABEL: Record<ActivityDTO['kind'], string> = {
  started: 'Started',
  completed: 'Completed',
  updated: 'Edited',
  reopened: 'Reopened',
  reset: 'Reset to not started',
  removed: 'Removed'
}

function RecordDialog({ recordId, onClose }: { recordId: string; onClose: () => void }) {
  const toast = useToast()
  const { household } = useAppData()
  const [detail, setDetail] = useState<RecordDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [version, setVersion] = useState(0)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getRecordDetail(recordId).then((result) => {
      if (cancelled) return
      if (result.ok) setDetail(result.data)
      else setLoadError(result.error)
    })
    return () => {
      cancelled = true
    }
  }, [recordId, version])

  const record = detail?.record
  const title = record ? `${record.subjectName} ${record.paceNumber}` : loadError ? 'Record unavailable' : 'Loading record…'
  const level = record ? paceLevel(record.paceNumber) : null

  function remove() {
    startTransition(async () => {
      const result = await deleteRecord(recordId)
      if (result.ok) {
        toast({ title: 'Record deleted', description: 'It no longer counts toward averages or reports.' })
        setConfirmDelete(false)
        onClose()
      } else {
        toast({ title: 'Couldn’t delete the record', description: result.error, tone: 'error' })
      }
    })
  }

  if (editing && detail) {
    return (
      <EditRecord
        detail={detail}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          setVersion((v) => v + 1)
        }}
      />
    )
  }

  return (
    <>
      <Dialog
        open={!confirmDelete}
        onClose={onClose}
        title={<span className={styles.recordTitle}>{record ? <>{record.subjectName} <span className="mono">{record.paceNumber}</span></> : title}</span>}
        description={record ? `${record.studentName}${level ? ` · Level ${level}` : ''}` : undefined}
        size="md"
        footerStart={
          record ? (
            <Button variant="ghost" size="sm" icon={Trash} className={styles.deleteButton} onClick={() => setConfirmDelete(true)}>
              Delete record
            </Button>
          ) : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {record ? (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)} data-autofocus>
                Edit
              </Button>
            ) : null}
          </>
        }
      >
        {loadError ? (
          <p className={styles.loadError}>{loadError}</p>
        ) : !detail || !record ? (
          <div className={styles.loading}>
            <Skeleton width="60%" />
            <Skeleton width="40%" />
            <Skeleton width="75%" />
          </div>
        ) : (
          <div className={styles.detail}>
            <dl className={styles.fields}>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusText status={record.status} />
                </dd>
              </div>
              <div>
                <dt>Test score</dt>
                <dd className={cx('tabular', styles.score, record.testScore !== null && record.testScore < detail.passMark && styles.danger)}>
                  {record.testScore !== null ? `${record.testScore}%` : '—'}
                </dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{record.startedOn ? formatLongDate(record.startedOn) : <span className={styles.muted}>Not recorded</span>}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{record.completedOn ? formatLongDate(record.completedOn) : <span className={styles.muted}>—</span>}</dd>
              </div>
            </dl>
            <div className={styles.notes}>
              <p className={styles.notesLabel}>Notes</p>
              <p className={cx(styles.notesText, !record.notes && styles.muted)}>{record.notes ?? 'No notes.'}</p>
            </div>
            <div>
              <p className={styles.notesLabel}>History</p>
              <ol className={styles.timeline}>
                {detail.history.map((event) => {
                  const enteredOn = todayIn(household.timezone, new Date(event.createdAt))
                  return (
                    <li key={event.id} className={styles.timelineItem}>
                      <span className={styles.timelineDot} aria-hidden />
                      <span className={styles.timelineText}>
                        <span>
                          {KIND_LABEL[event.kind]}
                          {event.kind === 'completed' && event.testScore !== null ? ` · ${event.testScore}%` : ''}
                        </span>
                        <span className={styles.timelineMeta}>
                          {formatShortDate(event.occurredOn, detail.today)} · {SOURCE_LABEL[event.source]}
                          {enteredOn !== event.occurredOn ? ` on ${formatShortDate(enteredOn, detail.today)}` : ''}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
            <Link href={`/students/${record.studentId}?subject=${record.subjectId}`} className={styles.profileLink} onClick={onClose}>
              View {record.studentName}’s {record.subjectName} progress
            </Link>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this record?"
        description={
          record
            ? `${record.subjectName} ${record.paceNumber} will be removed from ${record.studentName}’s history, averages and reports. The audit trail keeps a note that it was deleted.`
            : ''
        }
        confirmLabel="Delete record"
        pending={pending}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}

function EditRecord({ detail, onCancel, onSaved }: { detail: RecordDetail; onCancel: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { record, today, passMark } = detail
  const [pace, setPace] = useState(String(record.paceNumber))
  const [status, setStatus] = useState<PaceStatus>(record.status)
  const [startedOn, setStartedOn] = useState(record.startedOn ?? '')
  const [completedOn, setCompletedOn] = useState(record.completedOn ?? '')
  const [score, setScore] = useState(record.testScore !== null ? String(record.testScore) : '')
  const [notes, setNotes] = useState(record.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const losingCompletion = record.status === 'completed' && status !== 'completed'

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found: Record<string, string> = {}
    if (!/^\d{1,4}$/.test(pace) || Number(pace) < 1) found.paceNumber = 'Enter a PACE number.'
    if (status === 'completed' && !completedOn) found.completedOn = 'Add the completion date.'
    if (score && (Number(score) < 0 || Number(score) > 100)) found.testScore = 'Scores run from 0 to 100.'
    setErrors(found)
    if (Object.keys(found).length) return
    startTransition(async () => {
      const result = await updateRecord({
        recordId: record.id,
        paceNumber: Number(pace),
        status,
        startedOn: status === 'not_started' ? null : startedOn || null,
        completedOn: status === 'completed' ? completedOn || null : null,
        testScore: status === 'completed' && score ? Number(score) : null,
        notes
      })
      if (result.ok) {
        toast({ title: 'Record updated', description: 'The change is in the audit trail.' })
        onSaved()
      } else {
        setErrors({ [result.field ?? '_form']: result.error })
      }
    })
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={`Edit ${record.subjectName} ${record.paceNumber}`}
      description={`${record.studentName} · changes are recorded in the history`}
      size="md"
      fullOnMobile
      locked={pending}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-record-form" loading={pending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-record-form" className={styles.editForm} onSubmit={onSubmit} noValidate>
        {errors._form ? <p className={styles.loadError}>{errors._form}</p> : null}
        <div className={styles.editRow}>
          <Field label="PACE" error={errors.paceNumber}>
            {(p) => (
              <Input {...p} className="mono" inputMode="numeric" value={pace} maxLength={4} onChange={(e) => setPace(e.target.value.replace(/\D/g, '').slice(0, 4))} data-autofocus />
            )}
          </Field>
          <div className={styles.editStatus}>
            <span className={styles.notesLabel}>Status</span>
            <ChoiceGroup
              label="Status"
              variant="segmented"
              block
              value={status}
              onChange={setStatus}
              options={(['completed', 'active', 'not_started'] as const).map((value) => ({ value, label: PACE_STATUS_LABEL[value] }))}
            />
          </div>
        </div>
        {losingCompletion ? (
          <p className={styles.warning}>This clears the completion date and test score. They stay visible in the history.</p>
        ) : null}
        <div className={styles.editRow}>
          {status !== 'not_started' ? (
            <Field label="Started on" optional error={errors.startedOn}>
              {(p) => <Input {...p} type="date" max={today} value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />}
            </Field>
          ) : null}
          {status === 'completed' ? (
            <Field label="Completed on" error={errors.completedOn}>
              {(p) => <Input {...p} type="date" max={today} value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} />}
            </Field>
          ) : null}
        </div>
        {status === 'completed' ? (
          <Field label="Test score" error={errors.testScore} hint={`Pass mark ${passMark}%`}>
            {(p) => (
              <Input {...p} inputMode="numeric" numeric suffix="%" value={score} maxLength={3} onChange={(e) => setScore(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            )}
          </Field>
        ) : null}
        <Field label="Notes" optional>
          {(p) => <Textarea {...p} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </form>
    </Dialog>
  )
}
