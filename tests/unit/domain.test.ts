import { describe, expect, it } from 'vitest'
import { addMonths, diffDays, formatRange, formatRelativeDay, periodRange, startOfWeek, todayIn } from '@/domain/dates'
import { expectedDaysPerPace, studentStatusFrom, subjectSignals } from '@/domain/health'
import { averageScore, paceIndexInLevel, paceLevel } from '@/domain/pace'

describe('A.C.E. PACE numbering', () => {
  it('derives the level from core PACE numbers (12 per level)', () => {
    expect(paceLevel(1001)).toBe(1)
    expect(paceLevel(1084)).toBe(7)
    expect(paceLevel(1085)).toBe(8)
    expect(paceLevel(1144)).toBe(12)
    expect(paceLevel(999)).toBeNull()
    expect(paceIndexInLevel(1084)).toBe(12)
    expect(paceIndexInLevel(1085)).toBe(1)
  })
  it('averages only real scores', () => {
    expect(averageScore([94, null, 88])).toBe(91)
    expect(averageScore([null])).toBeNull()
  })
})

describe('calendar dates', () => {
  it('uses Monday-start weeks', () => {
    expect(startOfWeek('2026-10-02')).toBe('2026-09-28')
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28')
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28')
  })
  it('clamps month arithmetic to the month’s last day', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })
  it('resolves “today” in the household’s time zone', () => {
    const lateEvening = new Date('2026-10-03T03:30:00Z') // still Oct 2 in Chicago
    expect(todayIn('America/Chicago', lateEvening)).toBe('2026-10-02')
    expect(todayIn('Europe/London', lateEvening)).toBe('2026-10-03')
  })
  it('formats ranges and relative days', () => {
    expect(formatRange({ from: '2026-09-01', to: '2026-09-30' }, '2026-10-02')).toBe('Sep 1 – Sep 30')
    expect(formatRange({ from: '2025-12-15', to: '2026-01-10' })).toBe('Dec 15, 2025 – Jan 10, 2026')
    expect(formatRelativeDay('2026-10-01', '2026-10-02')).toBe('Yesterday')
    expect(diffDays('2026-09-28', '2026-10-02')).toBe(4)
  })
  it('computes named periods', () => {
    expect(periodRange('last_month', '2026-10-02', '2026-08-01')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(periodRange('week', '2026-10-02', '2026-08-01')).toEqual({ from: '2026-09-28', to: '2026-10-02' })
  })
})

describe('on-track signals', () => {
  const settings = { passMark: 80, pacesPerYear: 12 }
  const today = '2026-10-02'

  it('expects about three weeks per PACE at 12 a year', () => {
    expect(expectedDaysPerPace(12)).toBe(21)
  })

  it('flags a latest score below the pass mark', () => {
    const signals = subjectSignals(
      { active: { paceNumber: 1090, since: '2026-09-25' }, lastCompleted: { paceNumber: 1089, completedOn: '2026-09-22', testScore: 76 } },
      settings,
      today
    )
    expect(signals).toEqual([{ kind: 'below_pass', paceNumber: 1089, score: 76, passMark: 80 }])
    expect(studentStatusFrom(signals, true)).toBe('attention')
  })

  it('flags a PACE that has run well past the expected pace', () => {
    const signals = subjectSignals({ active: { paceNumber: 1025, since: '2026-08-25' }, lastCompleted: null }, settings, today)
    expect(signals).toEqual([{ kind: 'slow', paceNumber: 1025, days: 38, expectedDays: 21 }])
  })

  it('treats “nothing in progress” as a to-do, not a concern', () => {
    const signals = subjectSignals({ active: null, lastCompleted: { paceNumber: 1084, completedOn: today, testScore: 94 } }, settings, today)
    expect(signals).toEqual([{ kind: 'no_active', nextPace: 1085 }])
    expect(studentStatusFrom(signals, true)).toBe('on_track')
  })

  it('reports no records yet separately from on track', () => {
    expect(studentStatusFrom([], false)).toBe('not_started')
  })
})
