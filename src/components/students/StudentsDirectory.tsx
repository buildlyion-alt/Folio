'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArchiveRestore, Search, UserPlus } from 'lucide-react'
import { archiveStudent } from '@/app/actions/students'
import { Button } from '@/components/ui/Button'
import { ChoiceGroup } from '@/components/ui/Choice'
import { Input } from '@/components/ui/Field'
import { Avatar, EmptyState, PageHeader, Panel, StudentStatusLabel } from '@/components/ui/Misc'
import { SortableTh, tableStyles } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { formatRelativeDay } from '@/domain/dates'
import type { StudentOverviewDTO } from '@/domain/dto'
import { fullName, plural } from '@/domain/format'
import { subjectShortName } from '@/domain/subjects'
import { cx } from '@/lib/cx'
import { AddStudentDialog } from './AddStudentDialog'
import { NoStudents } from './NoStudents'
import styles from './Students.module.css'

type SortKey = 'name' | 'completed' | 'average' | 'status' | 'activity'
type StatusFilter = 'all' | 'on_track' | 'attention'

export function StudentsDirectory({
  students,
  today,
  passMark,
  archived,
  openNew
}: {
  students: StudentOverviewDTO[]
  today: string
  passMark: number
  archived: Array<{ id: string; firstName: string; lastName: string | null }>
  openNew: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const [adding, setAdding] = useState(openNew)
  const [restoring, startRestore] = useTransition()

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = students.filter((s) => {
      if (status !== 'all' && s.status !== status) return false
      if (!q) return true
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.enrollments.some((e) => e.subjectName.toLowerCase().includes(q) || String(e.current?.paceNumber ?? '').startsWith(q))
      )
    })
    const factor = sort.dir === 'asc' ? 1 : -1
    const value = (s: StudentOverviewDTO): number | string => {
      switch (sort.key) {
        case 'name':
          return s.displayName.toLowerCase()
        case 'completed':
          return s.completedLast30
        case 'average':
          return s.averageScore ?? -1
        case 'status':
          return s.status === 'attention' ? 0 : s.status === 'on_track' ? 1 : 2
        case 'activity':
          return s.lastActivity?.createdAt ?? ''
      }
    }
    return [...filtered].sort((a, b) => {
      const [x, y] = [value(a), value(b)]
      return x < y ? -factor : x > y ? factor : 0
    })
  }, [students, query, status, sort])

  function sortBy(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' || key === 'status' ? 'asc' : 'desc' }
    )
  }

  function closeAdd() {
    setAdding(false)
    if (openNew) router.replace('/students')
  }

  function restore(id: string, name: string) {
    startRestore(async () => {
      const result = await archiveStudent(id, false)
      if (result.ok) toast({ title: `${name} restored` })
      else toast({ title: 'Couldn’t restore', description: result.error, tone: 'error' })
    })
  }

  const attentionCount = students.filter((s) => s.status === 'attention').length

  return (
    <div className={styles.page}>
      <PageHeader
        title="Students"
        description={`${plural(students.length, 'student')} · ${attentionCount ? `${attentionCount} need${attentionCount === 1 ? 's' : ''} attention` : 'everyone on track'}`}
        actions={
          <Button variant="secondary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add student
          </Button>
        }
      />

      {students.length === 0 ? (
        <NoStudents />
      ) : (
        <Panel flush>
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <Input
                leadingIcon={Search}
                placeholder="Search by name, subject or PACE"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search students"
              />
            </div>
            <ChoiceGroup
              label="Filter by status"
              variant="segmented"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All' },
                { value: 'on_track', label: 'On track' },
                { value: 'attention', label: `Needs attention${attentionCount ? ` · ${attentionCount}` : ''}` }
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState compact icon={Search} title="No students match" actions={<Button size="sm" onClick={() => { setQuery(''); setStatus('all') }}>Clear filters</Button>}>
              Nothing matches {query ? `“${query}”` : 'that filter'}.
            </EmptyState>
          ) : (
            <>
              <div className={cx(tableStyles.scroll, styles.desktopOnly)}>
                <table className={cx(tableStyles.table, tableStyles.interactive)}>
                  <thead>
                    <tr>
                      <SortableTh label="Student" active={sort.key === 'name'} direction={sort.dir} onClick={() => sortBy('name')} />
                      <th scope="col">Current PACEs</th>
                      <SortableTh label="Completed · 30 days" align="end" active={sort.key === 'completed'} direction={sort.dir} onClick={() => sortBy('completed')} />
                      <SortableTh label="Avg. score" align="end" active={sort.key === 'average'} direction={sort.dir} onClick={() => sortBy('average')} />
                      <SortableTh label="Status" active={sort.key === 'status'} direction={sort.dir} onClick={() => sortBy('status')} />
                      <SortableTh label="Last activity" align="end" active={sort.key === 'activity'} direction={sort.dir} onClick={() => sortBy('activity')} />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((student) => (
                      <tr key={student.id} className={tableStyles.rowLinkRow}>
                        <td>
                          <Link href={`/students/${student.id}`} className={cx(tableStyles.rowLink, styles.nameCell)}>
                            <Avatar initials={student.initials} seed={student.id} size="md" />
                            <span className={styles.nameText}>
                              <span className={styles.name}>{student.displayName}</span>
                              <span className={styles.sub}>
                                {student.level ? `Level ${student.level} · ` : ''}
                                {plural(student.enrollments.length, 'subject')}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <span className={styles.paces}>
                            {student.enrollments.slice(0, 6).map((e) => (
                              <span key={e.enrollmentId} className={styles.pace} title={e.subjectName}>
                                <span className={styles.paceSubject}>{subjectShortName(e.subjectName)}</span>
                                <span className="mono">{e.current?.paceNumber ?? '—'}</span>
                              </span>
                            ))}
                            {student.enrollments.length > 6 ? <span className={styles.more}>+{student.enrollments.length - 6}</span> : null}
                          </span>
                        </td>
                        <td className={cx(tableStyles.num, !student.completedLast30 && tableStyles.muted)}>{student.completedLast30 || '—'}</td>
                        <td className={cx(tableStyles.num, student.averageScore !== null && student.averageScore < passMark && styles.danger, student.averageScore === null && tableStyles.muted)}>
                          {student.averageScore !== null ? `${student.averageScore}%` : '—'}
                        </td>
                        <td>
                          <StudentStatusLabel status={student.status} />
                        </td>
                        <td className={cx(tableStyles.num, tableStyles.muted, tableStyles.nowrap)}>
                          {student.lastActivity ? formatRelativeDay(student.lastActivity.occurredOn, today) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.mobileList}>
                {visible.map((student) => (
                  <li key={student.id}>
                    <Link href={`/students/${student.id}`} className={styles.mobileRow}>
                      <Avatar initials={student.initials} seed={student.id} size="lg" />
                      <span className={styles.nameText}>
                        <span className={styles.name}>{student.displayName}</span>
                        <StudentStatusLabel status={student.status} />
                        <span className={styles.sub}>
                          {student.enrollments
                            .filter((e) => e.current)
                            .slice(0, 4)
                            .map((e) => `${subjectShortName(e.subjectName)} ${e.current!.paceNumber}`)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className={cx(styles.mobileAvg, 'tabular')}>
                        {student.averageScore !== null ? `${student.averageScore}%` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}

      {archived.length ? (
        <section className={styles.archived} aria-labelledby="archived-title">
          <h2 id="archived-title" className={styles.archivedTitle}>
            Archived
          </h2>
          <ul className={styles.archivedList}>
            {archived.map((s) => (
              <li key={s.id} className={styles.archivedRow}>
                <Link href={`/students/${s.id}`} className={styles.archivedName}>
                  {fullName(s.firstName, s.lastName)}
                </Link>
                <Button size="sm" variant="ghost" icon={ArchiveRestore} disabled={restoring} onClick={() => restore(s.id, s.firstName)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AddStudentDialog open={adding} onClose={closeAdd} onCreated={(id) => router.push(`/students/${id}`)} />
    </div>
  )
}
