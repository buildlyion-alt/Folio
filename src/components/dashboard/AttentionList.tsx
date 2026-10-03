'use client'

import { useState, useTransition } from 'react'
import { CircleCheck, Play } from 'lucide-react'
import { startPace } from '@/app/actions/progress'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { Button } from '@/components/ui/Button'
import { Avatar, EmptyState, Panel } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import type { StudentConcernDTO } from '@/domain/dto'
import styles from './Dashboard.module.css'

export interface AttentionItem extends StudentConcernDTO {
  studentId: string
  studentName: string
  initials: string
  kind: 'concern' | 'todo'
}

const LIMIT = 6

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const openLog = useLogProgress()
  const toast = useToast()
  const [showAll, setShowAll] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const ordered = [...items.filter((i) => i.kind === 'concern'), ...items.filter((i) => i.kind === 'todo')]
  const visible = showAll ? ordered : ordered.slice(0, LIMIT)
  const concernCount = items.filter((i) => i.kind === 'concern').length

  function start(item: AttentionItem, paceNumber: number) {
    const key = `${item.studentId}:${item.subjectId}`
    setPendingKey(key)
    startTransition(async () => {
      const result = await startPace({ studentId: item.studentId, subjectId: item.subjectId, paceNumber })
      setPendingKey(null)
      if (result.ok) toast({ title: `${item.subjectName} ${paceNumber} started`, description: `${item.studentName}’s current PACE is updated.` })
      else toast({ title: 'Couldn’t start that PACE', description: result.error, tone: 'error' })
    })
  }

  return (
    <Panel
      title="Needs attention"
      meta={concernCount ? `${concernCount} to review` : ordered.length ? `${ordered.length} to do` : undefined}
      flush
    >
      {ordered.length === 0 ? (
        <EmptyState compact icon={CircleCheck} title="Nothing needs attention">
          Every subject has a PACE in progress and recent scores are above the pass mark.
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {visible.map((item) => {
            const { signal } = item
            const key = `${item.studentId}:${item.subjectId}:${signal.kind}`
            return (
              <li key={key} className={styles.listRow}>
                <Avatar initials={item.initials} seed={item.studentId} size="sm" />
                <div className={styles.listText}>
                  <p className={styles.listPrimary}>
                    {item.studentName} · {item.subjectName}
                    {'paceNumber' in signal ? <span className="mono"> {signal.paceNumber}</span> : null}
                  </p>
                  <p className={styles.listSecondary}>
                    {signal.kind === 'below_pass' ? (
                      <>
                        Scored <span className={styles.danger}>{signal.score}%</span> — below the {signal.passMark}% pass mark
                      </>
                    ) : signal.kind === 'slow' ? (
                      <>
                        <span className={styles.warning}>In progress {signal.days} days</span> · usually about {signal.expectedDays}
                      </>
                    ) : signal.nextPace ? (
                      <>Nothing in progress · {signal.nextPace} is next</>
                    ) : (
                      <>Nothing in progress yet</>
                    )}
                  </p>
                </div>
                {signal.kind === 'no_active' && signal.nextPace ? (
                  <Button
                    size="sm"
                    icon={Play}
                    loading={pendingKey === `${item.studentId}:${item.subjectId}`}
                    onClick={() => start(item, signal.nextPace!)}
                  >
                    Start {signal.nextPace}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      openLog({
                        studentId: item.studentId,
                        subjectId: item.subjectId,
                        paceNumber: 'paceNumber' in signal ? signal.paceNumber : undefined,
                        status: signal.kind === 'no_active' ? 'active' : 'completed'
                      })
                    }
                  >
                    {signal.kind === 'below_pass' ? 'Log retest' : signal.kind === 'slow' ? 'Log' : 'Set PACE'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {ordered.length > LIMIT ? (
        <button type="button" className={styles.showAll} onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? 'Show fewer' : `Show all ${ordered.length}`}
        </button>
      ) : null}
    </Panel>
  )
}
