'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { formatMonth, periodRange } from '@/domain/dates'
import type { SubjectDTO } from '@/domain/dto'
import type { ReportType } from '@/server/queries/reports'
import styles from './Reports.module.css'

interface ReportOption {
  type: ReportType
  title: string
  description: string
  needs?: 'student' | 'subject'
  defaultPeriod: 'week' | 'month' | 'year'
}

type PeriodChoice = 'week' | 'last_week' | 'year' | `month:${string}`

export function ReportLauncher({
  reports,
  students,
  subjects,
  months,
  today,
  schoolYearStart
}: {
  reports: ReportOption[]
  students: Array<{ id: string; name: string }>
  subjects: SubjectDTO[]
  months: string[]
  today: string
  schoolYearStart: string
}) {
  return (
    <ul className={styles.launcher}>
      {reports.map((report) => (
        <ReportRow
          key={report.type}
          report={report}
          students={students}
          subjects={subjects}
          months={months}
          today={today}
          schoolYearStart={schoolYearStart}
        />
      ))}
    </ul>
  )
}

function ReportRow({
  report,
  students,
  subjects,
  months,
  today,
  schoolYearStart
}: {
  report: ReportOption
  students: Array<{ id: string; name: string }>
  subjects: SubjectDTO[]
  months: string[]
  today: string
  schoolYearStart: string
}) {
  const router = useRouter()
  // In a month's first week, the month worth reporting on is usually the one that just ended.
  const defaultMonth = Number(today.slice(8, 10)) <= 7 && months[1] ? months[1] : months[0]
  const initial: PeriodChoice = report.defaultPeriod === 'month' ? `month:${defaultMonth}` : report.defaultPeriod
  const [period, setPeriod] = useState<PeriodChoice>(initial)
  const [target, setTarget] = useState(report.needs === 'student' ? (students[0]?.id ?? '') : report.needs === 'subject' ? (subjects[0]?.id ?? '') : '')

  function open() {
    const params = new URLSearchParams()
    if (period.startsWith('month:')) params.set('month', period.slice(6))
    else {
      const range = periodRange(period as 'week' | 'last_week' | 'year', today, schoolYearStart)
      params.set('from', range.from)
      params.set('to', range.to)
    }
    if (report.needs && target) params.set(report.needs, target)
    router.push(`/reports/${report.type}?${params.toString()}`)
  }

  const periodOptions =
    report.type === 'weekly'
      ? [
          { value: 'week', label: 'This week' },
          { value: 'last_week', label: 'Last week' }
        ]
      : report.type === 'monthly'
        ? months.map((m) => ({ value: `month:${m}`, label: formatMonth(`${m}-01`) }))
        : [
            { value: 'year', label: 'School year to date' },
            ...months.slice(0, 6).map((m) => ({ value: `month:${m}`, label: formatMonth(`${m}-01`) }))
          ]

  return (
    <li className={styles.row}>
      <span className={styles.rowIcon} aria-hidden>
        <ScrollText strokeWidth={1.75} />
      </span>
      <div className={styles.rowText}>
        <h2 className={styles.rowTitle}>{report.title}</h2>
        <p className={styles.rowDescription}>{report.description}</p>
      </div>
      <div className={styles.rowControls}>
        {report.needs === 'student' ? (
          <Select aria-label={`${report.title}: student`} value={target} onChange={(e) => setTarget(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : null}
        {report.needs === 'subject' ? (
          <Select aria-label={`${report.title}: subject`} value={target} onChange={(e) => setTarget(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Select aria-label={`${report.title}: period`} value={period} onChange={(e) => setPeriod(e.target.value as PeriodChoice)}>
          {periodOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button trailingIcon={ArrowRight} onClick={open} disabled={Boolean(report.needs) && !target} aria-label={`Open ${report.title}`}>
          Open
        </Button>
      </div>
    </li>
  )
}
