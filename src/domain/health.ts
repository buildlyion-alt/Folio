import { diffDays, type IsoDate } from './dates'

/**
 * "Is this child on track?" — derived, never stored.
 *
 * A.C.E. targets a fixed number of PACEs per subject per school year (12 by default)
 * across roughly 36 school weeks, so each PACE should take about three weeks. A subject
 * needs attention when its most recent PACE Test fell below the pass mark, or when the
 * current PACE has run well past that expected pace. A subject with nothing in progress
 * isn't "behind", but it's an action item: the next PACE probably needs starting.
 */

export const SCHOOL_WEEKS_PER_YEAR = 36
/** How far past the expected duration a PACE can run before it's flagged. */
export const SLOW_THRESHOLD = 1.5

export interface HealthSettings {
  passMark: number
  pacesPerYear: number
}

export function expectedDaysPerPace(pacesPerYear: number): number {
  return Math.max(1, Math.round((SCHOOL_WEEKS_PER_YEAR * 7) / pacesPerYear))
}

export interface SubjectHealthInput {
  /** The PACE currently in progress, if any. `since` = started date, or when it was recorded. */
  active: { paceNumber: number; since: IsoDate } | null
  lastCompleted: { paceNumber: number; completedOn: IsoDate; testScore: number | null } | null
}

export type SubjectSignal =
  | { kind: 'below_pass'; paceNumber: number; score: number; passMark: number }
  | { kind: 'slow'; paceNumber: number; days: number; expectedDays: number }
  | { kind: 'no_active'; nextPace: number | null }

export function subjectSignals(
  input: SubjectHealthInput,
  settings: HealthSettings,
  today: IsoDate
): SubjectSignal[] {
  const signals: SubjectSignal[] = []
  const { active, lastCompleted } = input

  if (
    lastCompleted &&
    lastCompleted.testScore !== null &&
    lastCompleted.testScore < settings.passMark
  ) {
    signals.push({
      kind: 'below_pass',
      paceNumber: lastCompleted.paceNumber,
      score: lastCompleted.testScore,
      passMark: settings.passMark
    })
  }

  if (active) {
    const expectedDays = expectedDaysPerPace(settings.pacesPerYear)
    const days = diffDays(active.since, today)
    if (days > expectedDays * SLOW_THRESHOLD) {
      signals.push({ kind: 'slow', paceNumber: active.paceNumber, days, expectedDays })
    }
  } else {
    signals.push({ kind: 'no_active', nextPace: lastCompleted ? lastCompleted.paceNumber + 1 : null })
  }

  return signals
}

/** Signals that make a student "Needs attention" (as opposed to a to-do). */
export function isConcern(signal: SubjectSignal): boolean {
  return signal.kind === 'below_pass' || signal.kind === 'slow'
}

export type StudentStatus = 'on_track' | 'attention' | 'not_started'

export function studentStatusFrom(
  signals: SubjectSignal[],
  hasAnyRecords: boolean
): StudentStatus {
  if (!hasAnyRecords) return 'not_started'
  return signals.some(isConcern) ? 'attention' : 'on_track'
}

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  on_track: 'On track',
  attention: 'Needs attention',
  not_started: 'No records yet'
}

export function describeSignal(signal: SubjectSignal, subjectName: string): string {
  switch (signal.kind) {
    case 'below_pass':
      return `${subjectName} ${signal.paceNumber} scored ${signal.score}% — below the ${signal.passMark}% pass mark`
    case 'slow':
      return `${subjectName} ${signal.paceNumber} in progress for ${signal.days} days`
    case 'no_active':
      return signal.nextPace
        ? `${subjectName} has no PACE in progress — ${signal.nextPace} is next`
        : `${subjectName} has no PACE in progress`
  }
}
