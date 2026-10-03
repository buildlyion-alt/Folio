'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { formatShortDate } from '@/domain/dates'
import styles from './Charts.module.css'

interface Week {
  weekStart: string
  completed: number
  isCurrent: boolean
}

function niceMax(value: number): number {
  if (value <= 4) return 4
  const step = value <= 10 ? 2 : value <= 25 ? 5 : value <= 60 ? 10 : 20
  return Math.ceil(value / step) * step
}

function ticksFor(max: number): number[] {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : 20
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
}

/** Column path: 4px rounded data-end, square at the baseline. */
function columnPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return ''
  const r = Math.min(4, width / 2, height)
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
}

/**
 * PACEs completed per week. Emphasis form: the current week carries the signal color,
 * earlier weeks stay neutral, and a hairline marks the household's weekly target.
 */
export function WeeklyChart({ data, target, today }: { data: Week[]; target: number; today: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const height = 200
  const margin = { top: 20, right: 12, bottom: 28, left: 32 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const max = niceMax(Math.max(target, ...data.map((d) => d.completed)))
  const band = plotW / data.length
  const barW = Math.min(24, band * 0.56)
  const y = (v: number) => margin.top + plotH - (v / max) * plotH
  const labelEvery = band < 44 ? 2 : 1
  const activeWeek = active !== null ? data[active] : null

  return (
    <div className={styles.chart}>
      {target > 0 ? (
        <p className={styles.key}>
          <span className={styles.keyLine} aria-hidden />
          Target ≈ {Math.round(target)} a week
        </p>
      ) : null}
      <div ref={wrapRef} className={styles.plot} onPointerLeave={() => setActive(null)}>
        <svg width={width} height={height} role="img" aria-labelledby={`${tableId}-title`} aria-describedby={tableId}>
          <title id={`${tableId}-title`}>{`PACEs completed per week, last ${data.length} weeks`}</title>
          {ticksFor(max).map((tick) => (
            <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className={styles.grid} />
              <text x={margin.left - 8} y={y(tick)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
                {tick}
              </text>
            </g>
          ))}
          {data.map((week, i) => {
            const cx = margin.left + band * i + band / 2
            const h = (week.completed / max) * plotH
            return (
              <g key={week.weekStart}>
                <path
                  d={columnPath(cx - barW / 2, y(week.completed), barW, h)}
                  className={week.isCurrent ? styles.barCurrent : active === i ? styles.barHover : styles.bar}
                />
                {i % labelEvery === 0 || week.isCurrent ? (
                  <text x={cx} y={height - 8} className={styles.tick} textAnchor="middle">
                    {week.isCurrent ? 'This wk' : formatShortDate(week.weekStart)}
                  </text>
                ) : null}
                {week.isCurrent && week.completed > 0 ? (
                  <text x={cx} y={y(week.completed) - 6} className={styles.valueLabel} textAnchor="middle">
                    {week.completed}
                  </text>
                ) : null}
                {/* Hit target: the whole band, not just the painted bar. */}
                <rect
                  x={margin.left + band * i}
                  y={margin.top}
                  width={band}
                  height={plotH}
                  className={styles.hit}
                  tabIndex={0}
                  role="button"
                  aria-label={`Week of ${formatShortDate(week.weekStart, today)}: ${week.completed} PACEs completed`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            )
          })}
          {/* Labelled in the key above the plot, so the label never sits on a bar. */}
          {target > 0 ? <line x1={margin.left} x2={width - margin.right} y1={y(target)} y2={y(target)} className={styles.target} /> : null}
          <line x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} className={styles.baseline} />
        </svg>
        {activeWeek && active !== null ? (
          <div
            className={styles.tooltip}
            style={{ left: Math.min(Math.max(margin.left + band * active + band / 2, 70), width - 70), top: y(activeWeek.completed) - 10 }}
            role="status"
          >
            <strong className="tabular">{activeWeek.completed}</strong>
            <span>
              {activeWeek.isCurrent ? 'This week' : `Week of ${formatShortDate(activeWeek.weekStart, today)}`}
            </span>
          </div>
        ) : null}
      </div>
      <details className={styles.tableToggle}>
        <summary>View as table</summary>
        <table id={tableId} className={styles.dataTable}>
          <thead>
            <tr>
              <th scope="col">Week of</th>
              <th scope="col">PACEs completed</th>
            </tr>
          </thead>
          <tbody>
            {data.map((week) => (
              <tr key={week.weekStart}>
                <td>{formatShortDate(week.weekStart, today)}</td>
                <td className="tabular">{week.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/** Inline meter: completed vs expected. Fill carries state; the track is a lighter step. */
export function PaceMeter({ value, expected }: { value: number; expected: number }) {
  const ratio = expected > 0 ? value / expected : value > 0 ? 1 : 0
  const tone = expected === 0 ? 'neutral' : ratio >= 0.95 ? 'good' : ratio >= 0.6 ? 'neutral' : 'behind'
  return (
    <span className={styles.meter} data-tone={tone} aria-hidden>
      <span className={styles.meterFill} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
    </span>
  )
}
