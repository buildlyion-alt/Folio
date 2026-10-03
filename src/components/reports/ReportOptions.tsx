'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Select } from '@/components/ui/Field'
import { cx } from '@/lib/cx'
import styles from './Reports.module.css'

export interface ReportPeriodChoice {
  value: string
  label: string
  params: Record<string, string>
}

/** The few choices a report has — who or what it covers, and when — applied as soon as they change. */
export function ReportOptions({
  type,
  needs,
  targets,
  target,
  periods,
  period,
  periodLabel,
  periodParams
}: {
  type: string
  needs?: 'student' | 'subject'
  targets: Array<{ id: string; name: string }>
  target: string | null
  periods: ReportPeriodChoice[]
  period: string | null
  /** Shown when the URL holds a range that isn't one of the options. */
  periodLabel: string
  periodParams: Record<string, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function go(next: { target?: string; period?: string }) {
    const params = new URLSearchParams()
    const chosenTarget = next.target ?? target
    if (needs && chosenTarget) params.set(needs, chosenTarget)
    const chosenPeriod = periods.find((o) => o.value === (next.period ?? period))
    for (const [key, value] of Object.entries(chosenPeriod ? chosenPeriod.params : periodParams)) params.set(key, value)
    startTransition(() => router.replace(`/reports/${type}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div className={cx(styles.options, pending && styles.optionsPending)}>
      {needs ? (
        <Select aria-label={needs === 'student' ? 'Student' : 'Subject'} value={target ?? ''} onChange={(e) => go({ target: e.target.value })}>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      ) : null}
      <Select aria-label="Period" value={period ?? ''} onChange={(e) => go({ period: e.target.value })}>
        {period === null ? <option value="">{periodLabel}</option> : null}
        {periods.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
