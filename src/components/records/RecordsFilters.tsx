'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { periodRange, type PeriodKey } from '@/domain/dates'
import type { SubjectDTO } from '@/domain/dto'
import type { RecordFilters } from '@/server/queries/records'
import { cx } from '@/lib/cx'
import styles from './Records.module.css'

type TextKey = 'q' | 'paceMin' | 'paceMax' | 'scoreMin' | 'scoreMax'

const PERIODS: Array<{ value: PeriodKey; label: string }> = [
  { value: 'week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'year', label: 'This school year' }
]

/**
 * Search first, then the three filters a parent actually reaches for: child, subject, when.
 * Status, exact dates, and PACE and score ranges wait behind "More filters".
 */
export function RecordsFilters({
  filters,
  students,
  subjects,
  today,
  schoolYearStart
}: {
  filters: RecordFilters
  students: Array<{ id: string; name: string }>
  subjects: SubjectDTO[]
  today: string
  schoolYearStart: string
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
  const fromRef = useRef<HTMLInputElement>(null)
  const [customDates, setCustomDates] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const panelId = useId()
  const moreId = useId()

  const preset = PERIODS.find(({ value }) => {
    const range = periodRange(value, today, schoolYearStart)
    return range.from === filters.from && range.to === filters.to
  })?.value
  const period = preset ?? (filters.from || filters.to || customDates ? 'custom' : '')
  const hiddenCount = [
    filters.status,
    filters.paceMin !== undefined || filters.paceMax !== undefined,
    filters.scoreMin !== undefined || filters.scoreMax !== undefined
  ].filter(Boolean).length
  const [moreOpen, setMoreOpen] = useState(hiddenCount > 0 || period === 'custom')
  const refinements = [filters.student, filters.subject, filters.from || filters.to].filter(Boolean).length + hiddenCount
  const active = refinements > 0 || Boolean(filters.q)

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

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    []
  )

  function choosePeriod(value: string) {
    if (value === 'custom') {
      setCustomDates(true)
      setMoreOpen(true)
      requestAnimationFrame(() => fromRef.current?.focus())
      return
    }
    setCustomDates(false)
    if (!value) return apply({ from: undefined, to: undefined })
    const range = periodRange(value as PeriodKey, today, schoolYearStart)
    apply({ from: range.from, to: range.to })
  }

  function clearAll() {
    if (timer.current) window.clearTimeout(timer.current)
    setText({ q: '', paceMin: '', paceMax: '', scoreMin: '', scoreMax: '' })
    setCustomDates(false)
    startTransition(() => router.replace(pathname, { scroll: false }))
  }

  return (
    <div className={cx(styles.filters, pending && styles.filtersPending, phoneOpen && styles.filtersOpen)} role="search" aria-label="Records">
      <div className={styles.filterBar}>
        <div className={styles.filterSearch}>
          <Input
            leadingIcon={Search}
            placeholder="Search names, subjects, PACEs, notes"
            value={text.q}
            onChange={(e) => setTextFilter('q', e.target.value)}
            aria-label="Search records"
            enterKeyHint="search"
          />
        </div>
        <Button
          variant="secondary"
          icon={SlidersHorizontal}
          className={styles.phoneToggle}
          aria-expanded={phoneOpen}
          aria-controls={panelId}
          onClick={() => setPhoneOpen((open) => !open)}
        >
          Filters{refinements ? ` · ${refinements}` : ''}
        </Button>
        <div id={panelId} className={styles.filterPrimary}>
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
          <Select aria-label="When" value={period} onChange={(e) => choosePeriod(e.target.value)}>
            <option value="">Any time</option>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom dates…</option>
          </Select>
          <button
            type="button"
            className={cx(styles.quietButton, styles.moreToggle)}
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((open) => !open)}
          >
            More filters{hiddenCount ? ` · ${hiddenCount}` : ''}
            <ChevronDown aria-hidden strokeWidth={1.75} />
          </button>
          {active ? (
            <button type="button" className={styles.quietButton} onClick={clearAll}>
              <X aria-hidden strokeWidth={1.75} />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div id={moreId} className={cx(styles.filterMore, moreOpen && styles.filterMoreOpen)}>
        <Select aria-label="Status" value={filters.status ?? ''} onChange={(e) => apply({ status: e.target.value || undefined })}>
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="active">In progress</option>
          <option value="not_started">Not started</option>
        </Select>
        <div className={styles.rangeGroup} role="group" aria-label="Dates">
          <Input
            ref={fromRef}
            type="date"
            aria-label="From date"
            value={filters.from ?? ''}
            onChange={(e) => {
              setCustomDates(true)
              apply({ from: e.target.value || undefined })
            }}
          />
          <span className={styles.rangeDash} aria-hidden>
            –
          </span>
          <Input
            type="date"
            aria-label="To date"
            value={filters.to ?? ''}
            onChange={(e) => {
              setCustomDates(true)
              apply({ to: e.target.value || undefined })
            }}
          />
        </div>
        <div className={styles.rangeGroup} role="group" aria-label="PACE numbers">
          <Input className="mono" inputMode="numeric" placeholder="PACE from" aria-label="PACE from" value={text.paceMin} onChange={(e) => setTextFilter('paceMin', e.target.value)} />
          <span className={styles.rangeDash} aria-hidden>
            –
          </span>
          <Input className="mono" inputMode="numeric" placeholder="to" aria-label="PACE to" value={text.paceMax} onChange={(e) => setTextFilter('paceMax', e.target.value)} />
        </div>
        <div className={styles.rangeGroup} role="group" aria-label="Scores">
          <Input inputMode="numeric" placeholder="Score from" aria-label="Score from" value={text.scoreMin} onChange={(e) => setTextFilter('scoreMin', e.target.value)} />
          <span className={styles.rangeDash} aria-hidden>
            –
          </span>
          <Input inputMode="numeric" placeholder="to %" aria-label="Score to" value={text.scoreMax} onChange={(e) => setTextFilter('scoreMax', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
