'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageSquareText } from 'lucide-react'
import { RecordList } from './RecordList'
import { SortableTh, tableStyles } from '@/components/ui/Table'
import { formatShortDate } from '@/domain/dates'
import type { RecordDTO } from '@/domain/dto'
import { resultLabel } from '@/domain/pace'
import type { RecordFilters } from '@/server/queries/records'
import { cx } from '@/lib/cx'
import styles from './Records.module.css'

type SortKey = NonNullable<RecordFilters['sort']>

/** The date a record is filed under — the same rule the server sorts by. */
export const filedOn = (record: RecordDTO) => record.completedOn ?? record.startedOn ?? record.createdAt.slice(0, 10)

export function RecordsTable({
  rows,
  filters,
  passMark,
  today
}: {
  rows: RecordDTO[]
  filters: RecordFilters
  passMark: number
  today: string
}) {
  const searchParams = useSearchParams()
  const sort = filters.sort ?? 'date'
  const dir = filters.dir ?? 'desc'

  function href(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key)
      else params.set(key, value)
    }
    return `/records?${params.toString()}`
  }

  function sortHref(key: SortKey) {
    const nextDir = sort === key ? (dir === 'asc' ? 'desc' : 'asc') : key === 'student' || key === 'subject' ? 'asc' : 'desc'
    return href({ sort: key, dir: nextDir, page: null, record: null })
  }

  const th = (key: SortKey, label: string, className?: string) => (
    <SortableTh label={label} active={sort === key} direction={dir} href={sortHref(key)} className={className} />
  )

  return (
    <>
      <RecordList records={rows} passMark={passMark} today={today} showStudent />
      <div className={cx(tableStyles.scroll, styles.tableWide)}>
        <table className={cx(tableStyles.table, tableStyles.interactive, styles.table)}>
          <thead>
            <tr>
              {th('student', 'Student')}
              {th('subject', 'Subject')}
              {th('pace', 'PACE')}
              {th('score', 'Result')}
              {th('date', 'Date')}
              <th scope="col" className={styles.noteCol}>
                <span className="visually-hidden">Notes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => {
              const result = resultLabel(record.status, record.testScore)
              const date = formatShortDate(filedOn(record), today)
              return (
                <tr key={record.id} className={tableStyles.rowLinkRow}>
                  <td>
                    <Link
                      href={href({ record: record.id })}
                      scroll={false}
                      replace
                      className={cx(tableStyles.rowLink, styles.studentCell)}
                      aria-label={`${record.studentName}, ${record.subjectName} ${record.paceNumber}, ${result}, ${date}. Open record.`}
                    >
                      {record.studentName}
                    </Link>
                  </td>
                  <td>{record.subjectName}</td>
                  <td className="mono">{record.paceNumber}</td>
                  <td
                    className={cx(
                      'tabular',
                      record.testScore !== null && record.testScore < passMark && styles.danger,
                      record.testScore === null && tableStyles.muted
                    )}
                  >
                    {result}
                  </td>
                  <td className={cx(tableStyles.nowrap, tableStyles.secondary, 'tabular')}>{date}</td>
                  <td className={cx(tableStyles.num, styles.noteCol)}>
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
