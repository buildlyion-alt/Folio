'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { Funnel, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import type { SubjectDTO } from '@/domain/dto'
import type { RecordFilters } from '@/server/queries/records'
import { cx } from '@/lib/cx'
import styles from './Records.module.css'

type TextKey = 'q' | 'paceMin' | 'paceMax' | 'scoreMin' | 'scoreMax'

export function RecordsFilters({
  filters,
  students,
  subjects
}: {
  filters: RecordFilters
  students: Array<{ id: string; name: string }>
  subjects: SubjectDTO[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState<Record<TextKey, string>>({
    q: filters.q ?? '',
    paceMin: filters.paceMin?.toString() ?? '',
    paceMax: filters.paceMax?.toString() ?? '',
    scoreMin: filters.scoreMin?.toString() ?? '',
    scoreMax: filters.scoreMax?.toString() ?? ''
  })
  const timer = useRef<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const moreId = useId()

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete('page')
    params.delete('record')
    const query = params.toString()
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  // Free-text and number filters apply after a short pause in typing.
  function setTextFilter(key: TextKey, value: string) {
    const next = key === 'q' ? value : value.replace(/\D/g, '').slice(0, key.startsWith('score') ? 3 : 4)
    setText((t) => ({ ...t, [key]: next }))
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => apply({ [key]: next.trim() || undefined }), 300)
  }

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  // Everything except the search box, counted per control, for the phone “Filters” button.
  const refinements = [
    filters.student,
    filters.subject,
    filters.status,
    filters.from || filters.to,
    filters.paceMin !== undefined || filters.paceMax !== undefined,
    filters.scoreMin !== undefined || filters.scoreMax !== undefined
  ].filter(Boolean).length
  const active = refinements > 0 || Boolean(filters.q)

  return (
    <div className={cx(styles.filters, pending && styles.filtersPending)} role="search" aria-label="Filter records">
      <div className={styles.filterSearchRow}>
        <div className={styles.filterSearch}>
          <Input
            leadingIcon={Search}
            placeholder="Search notes, names, PACE…"
            value={text.q}
            onChange={(e) => setTextFilter('q', e.target.value)}
            aria-label="Search records"
          />
        </div>
        <Button
          variant="secondary"
          icon={Funnel}
          className={styles.filterToggle}
          aria-expanded={expanded}
          aria-controls={moreId}
          onClick={() => setExpanded((open) => !open)}
        >
          Filters{refinements ? ` · ${refinements}` : ''}
        </Button>
      </div>
      <div id={moreId} className={cx(styles.filterMore, expanded && styles.filterMoreOpen)}>
        <Select aria-label="Student" value={filters.student ?? ''} onChange={(e) => apply({ student: e.target.value || undefined })}>
          <option value="">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Subject" value={filters.subject ?? ''} onChange={(e) => apply({ subject: e.target.value || undefined })}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Status" value={filters.status ?? ''} onChange={(e) => apply({ status: e.target.value || undefined })}>
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="active">Active</option>
          <option value="not_started">Not started</option>
        </Select>
        <div className={styles.rangeGroup} role="group" aria-label="Date range">
          <Input type="date" aria-label="From date" value={filters.from ?? ''} onChange={(e) => apply({ from: e.target.value || undefined })} />
          <span className={styles.rangeDash} aria-hidden>
            –
          </span>
          <Input type="date" aria-label="To date" value={filters.to ?? ''} onChange={(e) => apply({ to: e.target.value || undefined })} />
        </div>
        <div className={styles.rangeGroup} role="group" aria-label="PACE range">
          <Input className="mono" inputMode="numeric" placeholder="PACE from" aria-label="PACE from" value={text.paceMin} onChange={(e) => setTextFilter('paceMin', e.target.value)} />
          <span className={styles.rangeDash} aria-hidden>
            –
          </span>
          <Input className="mono" inputMode="numeric" placeholder="to" aria-label="PACE to" value={text.paceMax} onChange={(e) => setTextFilter('paceMax', e.target.value)} />
        </div>
        <div className={styles.rangeGroup} role="group" aria-label="Score range">
          <Input inputMode="numeric" placeholder="Score from" aria-label="Score from" value={text.scoreMin} onChange={(e) => setTextFilter('scoreMin', e.target.value)} />
          <span className={styles.rangeDash} aria-hidden>
            –
          </span>
          <Input inputMode="numeric" placeholder="to %" aria-label="Score to" value={text.scoreMax} onChange={(e) => setTextFilter('scoreMax', e.target.value)} />
        </div>
        {active ? (
          <Button
            variant="ghost"
            icon={X}
            onClick={() => {
              setText({ q: '', paceMin: '', paceMax: '', scoreMin: '', scoreMax: '' })
              startTransition(() => router.replace(pathname, { scroll: false }))
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
