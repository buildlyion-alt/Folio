'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { MessageSquareText } from 'lucide-react'
import { formatShortDate } from '@/domain/dates'
import type { RecordDTO } from '@/domain/dto'
import { resultLabel } from '@/domain/pace'
import { cx } from '@/lib/cx'
import styles from './RecordList.module.css'

/** Phone layout for record tables: one tappable row per record, the essentials only. */
export function RecordList({ records, passMark, today, showStudent }: { records: RecordDTO[]; passMark: number; today: string; showStudent?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const hrefFor = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('record', id)
    return `${pathname}?${params.toString()}`
  }

  return (
    <ul className={styles.list}>
      {records.map((record) => {
        const date = record.completedOn ?? record.startedOn ?? record.createdAt.slice(0, 10)
        const result = resultLabel(record.status, record.testScore)
        return (
          <li key={record.id}>
            <Link
              href={hrefFor(record.id)}
              scroll={false}
              replace
              className={styles.row}
              aria-label={`${showStudent ? `${record.studentName}, ` : ''}${record.subjectName} ${record.paceNumber}, ${result}, ${formatShortDate(date, today)}. Open record.`}
            >
              <span className={styles.main}>
                <span className={styles.title}>
                  {showStudent ? <span className={styles.student}>{record.studentName}</span> : null}
                  {record.subjectName} <span className="mono">{record.paceNumber}</span>
                  {record.notes ? <MessageSquareText className={styles.note} aria-hidden strokeWidth={1.75} /> : null}
                </span>
                <span className={styles.meta}>{formatShortDate(date, today)}</span>
              </span>
              <span className={cx(styles.score, record.testScore !== null && record.testScore < passMark && styles.danger, record.testScore === null && styles.muted)}>
                {result}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
