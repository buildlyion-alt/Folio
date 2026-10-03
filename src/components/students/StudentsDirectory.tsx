'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArchiveRestore, ChevronRight, Plus, Search } from 'lucide-react'
import { archiveStudent } from '@/app/actions/students'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Avatar, EmptyState, PageHeader } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import type { StudentOverviewDTO } from '@/domain/dto'
import { fullName, plural } from '@/domain/format'
import { AddStudentDialog } from './AddStudentDialog'
import { NoStudents } from './NoStudents'
import styles from './Students.module.css'

export function StudentsDirectory({
  students,
  archived,
  openNew
}: {
  students: StudentOverviewDTO[]
  archived: Array<{ id: string; firstName: string; lastName: string | null }>
  openNew: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(openNew)
  const [restoring, startRestore] = useTransition()

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.enrollments.some((e) => e.subjectName.toLowerCase().includes(q) || String(e.current?.paceNumber ?? '').startsWith(q))
    )
  }, [students, query])

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

  return (
    <div className={styles.page}>
      <PageHeader
        title="Students"
        description="Each child’s current PACEs and recent work."
        actions={
          <Button variant="ink" icon={Plus} onClick={() => setAdding(true)}>
            Add student
          </Button>
        }
      />

      {students.length === 0 ? (
        <NoStudents />
      ) : (
        <>
          {students.length > 3 ? (
            <div className={styles.search}>
              <Input
                leadingIcon={Search}
                placeholder="Search by name, subject or PACE"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search students"
              />
            </div>
          ) : null}

          {visible.length === 0 ? (
            <EmptyState compact icon={Search} title="No students match" actions={<Button size="sm" onClick={() => setQuery('')}>Clear search</Button>}>
              Nothing matches “{query}”.
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {visible.map((student) => (
                <li key={student.id}>
                  <Link href={`/students/${student.id}`} className={styles.row}>
                    <Avatar initials={student.initials} seed={student.id} size="lg" />
                    <span className={styles.body}>
                      <span className={styles.head}>
                        <span className={styles.name}>{student.displayName}</span>
                        {student.concerns.length ? (
                          <span className={styles.attention}>
                            <span className={styles.flag} aria-hidden />
                            Needs a look
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.paces}>
                        {student.level ? <span className={styles.level}>Level {student.level}</span> : null}
                        {student.enrollments.map((e) => (
                          <span key={e.enrollmentId} className={styles.pace}>
                            {e.subjectName} <span className="mono">{e.current?.paceNumber ?? '—'}</span>
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className={styles.week}>
                      {student.completedThisWeek ? `${plural(student.completedThisWeek, 'PACE')} this week` : 'None this week'}
                    </span>
                    <ChevronRight className={styles.chevron} aria-hidden strokeWidth={1.75} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
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
