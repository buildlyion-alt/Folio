'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { ArrowRight, Check, CircleAlert, Pencil, Play, Sparkles, TriangleAlert, X } from 'lucide-react'
import { applyAssistantChanges } from '@/app/actions/assistant'
import type { AppliedChange } from '@/server/services/assistant'
import { startPace } from '@/app/actions/progress'
import { useAppData } from '@/components/providers/AppData'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Avatar, Badge } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import { formatShortDate, isIsoDate } from '@/domain/dates'
import { plural } from '@/domain/format'
import { PACE_STATUS_LABEL, type PaceStatus } from '@/domain/pace'
import type { AssistantResponse, ProposedChange } from '@/server/assistant/types'
import { cx } from '@/lib/cx'
import styles from './Assistant.module.css'

export function AssistantResult({
  response,
  onDone,
  onExample,
  bare
}: {
  bare?: boolean
  response: AssistantResponse
  /** Called when the interaction is finished (confirmed, cancelled, or navigated away). */
  onDone: (outcome: 'saved' | 'cancelled' | 'navigated') => void
  onExample?: (text: string) => void
}) {
  return <div className={cx(bare && styles.bare)}>{renderResult(response, onDone, onExample)}</div>
}

function renderResult(
  response: AssistantResponse,
  onDone: (outcome: 'saved' | 'cancelled' | 'navigated') => void,
  onExample?: (text: string) => void
) {
  switch (response.type) {
    case 'proposals':
      return <ProposalReview response={response} onDone={onDone} />
    case 'answer':
      return <AnswerView response={response} onDone={onDone} />
    case 'navigate':
      return <NavigateView response={response} onDone={onDone} />
    case 'unknown':
      return (
        <div className={styles.result}>
          <ResultHeader title={response.message} provider={response.provider} icon="info" />
          {response.notice ? <p className={styles.notice}>{response.notice}</p> : null}
          <div className={styles.examples}>
            {response.examples.map((example) => (
              <button key={example} type="button" className={styles.example} onClick={() => onExample?.(example)}>
                {example}
              </button>
            ))}
          </div>
        </div>
      )
  }
}

function ResultHeader({
  title,
  subtitle,
  icon = 'sparkles'
}: {
  title: string
  subtitle?: string
  provider?: 'openai' | 'offline'
  icon?: 'sparkles' | 'info' | 'check'
}) {
  const Icon = icon === 'check' ? Check : icon === 'info' ? CircleAlert : Sparkles
  return (
    <div className={styles.resultHeader}>
      <span className={cx(styles.resultIcon, icon === 'check' && styles.resultIconDone)} aria-hidden>
        <Icon strokeWidth={2} />
      </span>
      <div className={styles.resultTitles}>
        <p className={styles.resultTitle}>{title}</p>
        {subtitle ? <p className={styles.resultSubtitle}>{subtitle}</p> : null}
      </div>
    </div>
  )
}

type Editable = ProposedChange & { included: boolean }

function validateChange(change: Editable, today: string): string | null {
  // Problems found by the server stand until the parent edits that change.
  if (change.error) return change.error
  if (!change.studentId) return 'Choose a student.'
  if (!change.subjectId) return 'Choose a subject.'
  if (!change.paceNumber || change.paceNumber < 1 || change.paceNumber > 9999) return 'Enter a PACE number.'
  if (change.status === 'completed' && change.testScore !== null && (change.testScore < 0 || change.testScore > 100)) {
    return 'Scores run from 0 to 100.'
  }
  if (change.status !== 'not_started' && (!change.date || !isIsoDate(change.date) || change.date > today)) {
    return 'Choose a date that isn’t in the future.'
  }
  return null
}

function ProposalReview({
  response,
  onDone
}: {
  response: Extract<AssistantResponse, { type: 'proposals' }>
  onDone: (outcome: 'saved' | 'cancelled') => void
}) {
  const { roster, today, household } = useAppData()
  const toast = useToast()
  const [items, setItems] = useState<Editable[]>(() => response.changes.map((c) => ({ ...c, included: !c.error })))
  const [editing, setEditing] = useState(() => response.changes.some((c) => c.error && c.studentId))
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<AppliedChange[] | null>(null)
  const [pending, startTransition] = useTransition()

  const patch = (key: string, values: Partial<Editable>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...values, error: null } : item)))

  const included = items.filter((i) => i.included)
  const problems = included.map((i) => validateChange(i, today)).filter(Boolean)
  const canConfirm = included.length > 0 && problems.length === 0

  function confirm() {
    setError(null)
    startTransition(async () => {
      const result = await applyAssistantChanges(
        included.map((i) => ({
          studentId: i.studentId,
          subjectId: i.subjectId,
          paceNumber: i.paceNumber,
          status: i.status,
          testScore: i.status === 'completed' ? i.testScore : null,
          date: i.status === 'not_started' ? null : i.date,
          notes: i.notes
        }))
      )
      if (result.ok) {
        setApplied(result.data)
        toast({ title: `${plural(result.data.length, 'update')} saved`, description: 'Home, profiles and records are up to date.' })
      } else {
        setError(result.error)
      }
    })
  }

  if (applied) return <AppliedView applied={applied} provider={response.provider} onDone={() => onDone('saved')} />

  const detected = response.changes.length
  return (
    <div className={styles.result}>
      <ResultHeader
        title={detected === 1 ? '1 update detected' : `${detected} updates detected`}
        subtitle="Nothing is saved until you confirm."
        provider={response.provider}
      />
      {response.notice ? <p className={styles.notice}>{response.notice}</p> : null}

      <ul className={styles.changes} aria-label="Proposed updates">
        {items.map((item) => {
          const student = roster.find((s) => s.id === item.studentId) ?? null
          const problem = item.included ? validateChange(item, today) : null
          return (
            <li key={item.key} className={cx(styles.change, !item.included && styles.changeExcluded)}>
              <div className={styles.changeMain}>
                <Avatar initials={student?.initials ?? '?'} seed={item.studentId ?? item.key} size="sm" />
                {editing ? (
                  <div className={styles.editGrid}>
                    <Select
                      aria-label="Student"
                      value={item.studentId ?? ''}
                      onChange={(e) => patch(item.key, { studentId: e.target.value || null, subjectId: null, subjectName: null, studentName: roster.find((s) => s.id === e.target.value)?.firstName ?? item.studentName })}
                    >
                      <option value="">Student…</option>
                      {roster.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label="Subject"
                      value={item.subjectId ?? ''}
                      onChange={(e) =>
                        patch(item.key, {
                          subjectId: e.target.value || null,
                          subjectName: student?.subjects.find((s) => s.subjectId === e.target.value)?.subjectName ?? null
                        })
                      }
                    >
                      <option value="">Subject…</option>
                      {(student?.subjects ?? []).map((s) => (
                        <option key={s.subjectId} value={s.subjectId}>
                          {s.subjectName}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label="PACE number"
                      leadingText="PACE"
                      className="mono"
                      inputMode="numeric"
                      value={item.paceNumber ?? ''}
                      maxLength={4}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                        patch(item.key, { paceNumber: digits ? Number(digits) : null })
                      }}
                    />
                    <Select aria-label="Status" value={item.status} onChange={(e) => patch(item.key, { status: e.target.value as PaceStatus })}>
                      {(['completed', 'active', 'not_started'] as const).map((s) => (
                        <option key={s} value={s}>
                          {PACE_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </Select>
                    <Input
                      aria-label="Test score"
                      inputMode="numeric"
                      numeric
                      suffix="%"
                      placeholder="—"
                      disabled={item.status !== 'completed'}
                      value={item.status === 'completed' ? (item.testScore ?? '') : ''}
                      maxLength={3}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
                        patch(item.key, { testScore: digits ? Number(digits) : null })
                      }}
                    />
                    <Input
                      aria-label="Date"
                      type="date"
                      max={today}
                      disabled={item.status === 'not_started'}
                      value={item.date ?? ''}
                      onChange={(e) => patch(item.key, { date: e.target.value || null })}
                    />
                  </div>
                ) : (
                  <div className={styles.changeSummary}>
                    <p className={styles.changeTitle}>
                      <span>{item.studentName}</span>
                      {item.subjectName ? <span className={styles.changeSubject}>{item.subjectName}</span> : null}
                    </p>
                    <dl className={styles.changeFields}>
                      <div>
                        <dt>PACE</dt>
                        <dd className="mono">{item.paceNumber ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{item.status === 'active' ? 'Started' : PACE_STATUS_LABEL[item.status]}</dd>
                      </div>
                      {item.status === 'completed' ? (
                        <div>
                          <dt>Score</dt>
                          <dd className={cx('tabular', item.testScore !== null && item.testScore < household.passMark && styles.danger)}>
                            {item.testScore !== null ? `${item.testScore}%` : '—'}
                          </dd>
                        </div>
                      ) : null}
                      {item.date ? (
                        <div>
                          <dt>Date</dt>
                          <dd>{item.date === today ? 'Today' : formatShortDate(item.date, today)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={item.included ? X : Check}
                  aria-label={item.included ? 'Leave this update out' : 'Include this update'}
                  title={item.included ? 'Leave out' : 'Include'}
                  onClick={() => setItems((list) => list.map((i) => (i.key === item.key ? { ...i, included: !i.included } : i)))}
                />
              </div>
              {item.included && (problem || item.warnings.length) ? (
                <ul className={styles.messages}>
                  {problem ? (
                    <li className={styles.messageError}>
                      <CircleAlert aria-hidden strokeWidth={2} />
                      {problem}
                    </li>
                  ) : null}
                  {item.warnings.map((warning) => (
                    <li key={warning} className={styles.messageWarning}>
                      <TriangleAlert aria-hidden strokeWidth={2} />
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!item.included && item.error ? <p className={styles.excludedNote}>{item.error}</p> : null}
            </li>
          )
        })}
      </ul>

      {error ? (
        <p className={styles.applyError} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button variant="primary" icon={Check} onClick={confirm} disabled={!canConfirm} loading={pending}>
          {included.length === 1 ? 'Confirm update' : `Confirm ${included.length} updates`}
        </Button>
        <Button variant="secondary" icon={Pencil} onClick={() => setEditing((v) => !v)} disabled={pending} aria-pressed={editing}>
          {editing ? 'Done editing' : 'Edit'}
        </Button>
        <Button variant="ghost" onClick={() => onDone('cancelled')} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function AppliedView({
  applied,
  provider,
  onDone
}: {
  applied: AppliedChange[]
  provider: 'openai' | 'offline'
  onDone: () => void
}) {
  const toast = useToast()
  const [started, setStarted] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  function start(change: AppliedChange) {
    if (!change.nextPace) return
    startTransition(async () => {
      const result = await startPace({ studentId: change.studentId, subjectId: change.subjectId, paceNumber: change.nextPace! })
      if (result.ok) {
        setStarted((set) => new Set(set).add(change.recordId))
        toast({ title: `${change.subjectName} ${change.nextPace} started`, description: `${change.studentName}’s current PACE is updated.` })
      } else {
        toast({ title: 'Couldn’t start the next PACE', description: result.error, tone: 'error' })
      }
    })
  }

  return (
    <div className={styles.result} role="status">
      <ResultHeader title={`${plural(applied.length, 'update')} saved`} subtitle="Home, profiles and records now reflect this." provider={provider} icon="check" />
      <ul className={styles.appliedList}>
        {applied.map((change) => (
          <li key={change.recordId} className={styles.applied}>
            <span className={styles.appliedText}>
              <Link href={`/students/${change.studentId}?record=${change.recordId}`} className={styles.appliedLink}>
                {change.studentName} · {change.subjectName} <span className="mono">{change.paceNumber}</span>
              </Link>
              <span className={styles.appliedMeta}>
                {change.status === 'completed'
                  ? `Completed${change.testScore !== null ? ` · ${change.testScore}%` : ''}`
                  : change.status === 'active'
                    ? 'Started'
                    : 'Not started'}
              </span>
            </span>
            {change.nextPace && !started.has(change.recordId) ? (
              <Button size="sm" icon={Play} onClick={() => start(change)} disabled={pending}>
                Start {change.nextPace}
              </Button>
            ) : started.has(change.recordId) ? (
              <Badge tone="signal">Started {change.nextPace}</Badge>
            ) : null}
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

function AnswerView({
  response,
  onDone
}: {
  response: Extract<AssistantResponse, { type: 'answer' }>
  onDone: (outcome: 'navigated' | 'cancelled') => void
}) {
  return (
    <div className={styles.result}>
      <ResultHeader title={response.title} subtitle={response.summary} provider={response.provider} />
      {response.notice ? <p className={styles.notice}>{response.notice}</p> : null}
      {response.rows.length ? (
        <ul className={styles.answerRows}>
          {response.rows.map((row, index) => {
            const content = (
              <>
                <span className={styles.answerText}>
                  <span className={styles.answerPrimary}>{row.primary}</span>
                  {row.secondary ? <span className={styles.answerSecondary}>{row.secondary}</span> : null}
                </span>
                {row.value ? (
                  <span className={cx(styles.answerValue, row.tone === 'danger' && styles.danger, row.tone === 'signal' && styles.signalText)}>
                    {row.value}
                  </span>
                ) : null}
              </>
            )
            return (
              <li key={`${row.primary}-${index}`}>
                {row.href ? (
                  <Link href={row.href} className={styles.answerRow} onClick={() => onDone('navigated')}>
                    {content}
                  </Link>
                ) : (
                  <div className={styles.answerRow}>{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
      {response.link ? (
        <div className={styles.actions}>
          <Link href={response.link.href} className={styles.answerLink} onClick={() => onDone('navigated')}>
            {response.link.label}
            <ArrowRight aria-hidden strokeWidth={1.75} />
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function NavigateView({
  response,
  onDone
}: {
  response: Extract<AssistantResponse, { type: 'navigate' }>
  onDone: (outcome: 'navigated') => void
}) {
  const router = useRouter()
  useEffect(() => {
    router.push(response.href)
    onDone('navigated')
    // Navigate exactly once per response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response.href])
  return (
    <div className={styles.result} role="status">
      <ResultHeader title={`Opening ${response.title}…`} provider={response.provider} />
    </div>
  )
}
