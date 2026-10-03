'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MessageSquareText } from 'lucide-react'
import { StatusText } from '@/components/students/StudentProfile'
import { RecordList } from './RecordList'
import { Avatar } from '@/components/ui/Misc'
import { SortableTh, tableStyles } from '@/components/ui/Table'
import { formatTableDate } from '@/domain/dates'
import type { RecordDTO } from '@/domain/dto'
import { initials } from '@/domain/format'
import { PACE_STATUS_LABEL } from '@/domain/pace'
import type { RecordFilters } from '@/server/queries/records'
import { cx } from '@/lib/cx'
import styles from './Records.module.css'

type SortKey = NonNullable<RecordFilters['sort']>

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

  const th = (key: SortKey, label: string, align?: 'end') => (
    <SortableTh label={label} active={sort === key} direction={dir} href={sortHref(key)} align={align} />
  )

  return (
    <>
      <RecordList records={rows} passMark={passMark} today={today} showStudent />
      <div className={cx(tableStyles.scroll, styles.tableWide)}>
        <table className={cx(tableStyles.table, tableStyles.interactive)}>
          <thead>
            <tr>
              {th('student', 'Student')}
              {th('subject', 'Subject')}
              {th('pace', 'PACE')}
              {th('score', 'Score', 'end')}
              {th('status', 'Status')}
              <th scope="col">Started</th>
              {th('date', 'Completed')}
              <th scope="col">
                <span className="visually-hidden">Notes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr key={record.id} className={tableStyles.rowLinkRow}>
                <td>
                  <Link
                    href={href({ record: record.id })}
                    scroll={false}
                    replace
                    className={cx(tableStyles.rowLink, styles.studentCell)}
                    aria-label={`${record.studentName}, ${record.subjectName} ${record.paceNumber}, ${PACE_STATUS_LABEL[record.status]}${record.testScore !== null ? `, ${record.testScore}%` : ''}. Open record.`}
                  >
                    <Avatar initials={initials(record.studentName)} seed={record.studentId} size="sm" />
                    {record.studentName}
                  </Link>
                </td>
                <td>{record.subjectName}</td>
                <td className="mono">{record.paceNumber}</td>
                <td className={cx(tableStyles.num, record.testScore !== null && record.testScore < passMark && styles.danger, record.testScore === null && tableStyles.muted)}>
                  {record.testScore !== null ? `${record.testScore}%` : '—'}
                </td>
                <td>
                  <StatusText status={record.status} />
                </td>
                <td className={cx(tableStyles.secondary, tableStyles.nowrap, 'tabular')}>
                  {record.startedOn ? formatTableDate(record.startedOn, today) : <span className={tableStyles.muted}>—</span>}
                </td>
                <td className={cx(tableStyles.nowrap, 'tabular')}>
                  {record.completedOn ? formatTableDate(record.completedOn, today) : <span className={tableStyles.muted}>—</span>}
                </td>
                <td className={tableStyles.num}>
                  {record.notes ? <MessageSquareText className={styles.noteIcon} aria-label="Has notes" strokeWidth={1.75} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
