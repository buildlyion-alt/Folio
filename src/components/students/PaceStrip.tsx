'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Check, Plus } from 'lucide-react'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { formatShortDate } from '@/domain/dates'
import type { EnrollmentDTO, RecordDTO } from '@/domain/dto'
import { paceIndexInLevel, paceLevel } from '@/domain/pace'
import { cx } from '@/lib/cx'
import styles from './Profile.module.css'

const MAX_CELLS = 14

type CellKind = 'completed' | 'active' | 'not_started' | 'gap' | 'next' | 'upcoming'

interface StripCell {
  paceNumber: number
  kind: CellKind
  record: RecordDTO | null
}

export function buildStrip(enrollment: EnrollmentDTO, records: RecordDTO[]): { cells: StripCell[]; hiddenBefore: number } {
  const byPace = new Map(records.map((r) => [r.paceNumber, r]))
  const known = records.map((r) => r.paceNumber)
  const current = enrollment.current?.paceNumber ?? null
  if (current !== null) known.push(current)
  if (known.length === 0) return { cells: [], hiddenBefore: 0 }

  const lowest = Math.min(...known)
  const highest = Math.max(...known)
  // With no history yet, show two earlier slots to invite backfilling.
  let start = records.some((r) => r.status === 'completed') ? lowest : Math.max(1, lowest - 2)
  const end = Math.min(9999, highest + 2)
  let hiddenBefore = 0
  if (end - start + 1 > MAX_CELLS) {
    const newStart = end - MAX_CELLS + 1
    hiddenBefore = records.filter((r) => r.paceNumber < newStart).length
    start = newStart
  }

  const lastCompleted = Math.max(0, ...records.filter((r) => r.status === 'completed').map((r) => r.paceNumber))
  const nextNumber = current !== null ? current + 1 : lastCompleted + 1

  const cells: StripCell[] = []
  for (let n = start; n <= end; n++) {
    const record = byPace.get(n) ?? null
    let kind: CellKind
    if (record) kind = record.status === 'completed' ? 'completed' : record.status === 'active' ? 'active' : 'not_started'
    else if (n === nextNumber) kind = 'next'
    else if (n < highest) kind = 'gap'
    else kind = 'upcoming'
    cells.push({ paceNumber: n, kind, record })
  }
  return { cells, hiddenBefore }
}

function describe(cell: StripCell, subjectName: string, passMark: number, today: string): string {
  const base = `${subjectName} ${cell.paceNumber}`
  switch (cell.kind) {
    case 'completed': {
      const r = cell.record!
      const score = r.testScore !== null ? `, ${r.testScore}%${r.testScore < passMark ? ' (below pass mark)' : ''}` : ', no score'
      return `${base}, completed ${r.completedOn ? formatShortDate(r.completedOn, today) : ''}${score}. Open record.`
    }
    case 'active':
      return `${base}, in progress. Open record.`
    case 'not_started':
      return `${base}, not started. Open record.`
    case 'gap':
      return `${base}, no record. Add a past result.`
    case 'next':
      return `${base}, next PACE. Start it.`
    default:
      return `${base}, upcoming.`
  }
}

export function PaceStrip({
  studentId,
  enrollment,
  records,
  passMark,
  today
}: {
  studentId: string
  enrollment: EnrollmentDTO
  records: RecordDTO[]
  passMark: number
  today: string
}) {
  const openLog = useLogProgress()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { cells, hiddenBefore } = buildStrip(enrollment, records)
  const wrapRef = useRef<HTMLDivElement>(null)

  // On narrow screens the strip scrolls; start with the current PACE in view, not the oldest.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth) return
    const current = wrap.querySelector<HTMLElement>('[data-current="true"]')
    wrap.scrollLeft = current ? current.offsetLeft + current.offsetWidth - wrap.clientWidth + 80 : wrap.scrollWidth
  }, [])

  if (cells.length === 0) {
    return (
      <button
        type="button"
        className={styles.stripEmpty}
        onClick={() => openLog({ studentId, subjectId: enrollment.subjectId, status: 'active' })}
      >
        <Plus aria-hidden strokeWidth={1.75} /> Set the current PACE
      </button>
    )
  }

  function openRecord(recordId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('record', recordId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function activate(cell: StripCell) {
    if (cell.record) return openRecord(cell.record.id)
    if (cell.kind === 'gap') return openLog({ studentId, subjectId: enrollment.subjectId, paceNumber: cell.paceNumber, status: 'completed' })
    if (cell.kind === 'next') return openLog({ studentId, subjectId: enrollment.subjectId, paceNumber: cell.paceNumber, status: 'active' })
  }

  return (
    <div className={styles.stripWrap} ref={wrapRef}>
      {hiddenBefore ? <span className={styles.stripEarlier}>+{hiddenBefore} earlier</span> : null}
      <ol className={styles.strip} aria-label={`${enrollment.subjectName} PACE progression`}>
        {cells.map((cell, index) => {
          const level = paceLevel(cell.paceNumber)
          const levelStart = level !== null && (index === 0 || paceIndexInLevel(cell.paceNumber) === 1)
          const below = cell.kind === 'completed' && cell.record!.testScore !== null && cell.record!.testScore < passMark
          const interactive = cell.kind !== 'upcoming'
          return (
            <li key={cell.paceNumber} className={cx(styles.stripItem, levelStart && index > 0 && styles.levelBreak)}>
              <span className={styles.levelLabel} aria-hidden>
                {levelStart ? `Level ${level}` : ''}
              </span>
              <button
                type="button"
                className={cx(styles.cell, styles[`cell_${cell.kind}`], below && styles.cellBelow)}
                aria-label={describe(cell, enrollment.subjectName, passMark, today)}
                onClick={() => activate(cell)}
                disabled={!interactive}
                tabIndex={interactive ? 0 : -1}
                data-current={cell.kind === 'active' || undefined}
              >
                <span className={cx('mono', styles.cellNumber)}>{cell.paceNumber}</span>
                <span className={styles.cellMeta}>
                  {cell.kind === 'completed' ? (
                    cell.record!.testScore !== null ? (
                      <span className="tabular">{cell.record!.testScore}</span>
                    ) : (
                      <Check aria-hidden strokeWidth={2.25} />
                    )
                  ) : cell.kind === 'active' ? (
                    'Active'
                  ) : cell.kind === 'not_started' ? (
                    'Planned'
                  ) : cell.kind === 'next' ? (
                    'Next'
                  ) : cell.kind === 'gap' ? (
                    <Plus aria-hidden strokeWidth={2} />
                  ) : (
                    ''
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
