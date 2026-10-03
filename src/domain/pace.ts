/**
 * A.C.E. PACE conventions. Core-curriculum PACEs are numbered 1001–1144:
 * twelve per academic level, so 1073–1084 is Level 7 and 1085 begins Level 8.
 * Electives and some publisher editions use other ranges, so any 1–9999 is accepted;
 * the level is only derived when a number falls inside the core range.
 */

export const PACE_MIN = 1
export const PACE_MAX = 9999
export const CORE_FIRST = 1001
export const CORE_LAST = 1144
export const PACES_PER_LEVEL = 12

export type PaceStatus = 'not_started' | 'active' | 'completed'

export const PACE_STATUS_LABEL: Record<PaceStatus, string> = {
  not_started: 'Not started',
  active: 'In progress',
  completed: 'Completed'
}

/** What a record shows in a list: its score when it has one, otherwise where it stands. */
export function resultLabel(status: PaceStatus, testScore: number | null): string {
  if (status === 'completed') return testScore !== null ? `${testScore}%` : 'Completed'
  return PACE_STATUS_LABEL[status]
}

export function isValidPaceNumber(value: number): boolean {
  return Number.isInteger(value) && value >= PACE_MIN && value <= PACE_MAX
}

export function isCorePace(value: number): boolean {
  return Number.isInteger(value) && value >= CORE_FIRST && value <= CORE_LAST
}

/** Level 1–12 for core PACE numbers, otherwise null. */
export function paceLevel(paceNumber: number): number | null {
  if (!isCorePace(paceNumber)) return null
  return Math.ceil((paceNumber - 1000) / PACES_PER_LEVEL)
}

/** Position within its level: 1084 → 12 (of 12). */
export function paceIndexInLevel(paceNumber: number): number | null {
  if (!isCorePace(paceNumber)) return null
  return ((paceNumber - CORE_FIRST) % PACES_PER_LEVEL) + 1
}

export function firstPaceOfLevel(level: number): number {
  return 1000 + (level - 1) * PACES_PER_LEVEL + 1
}

export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? '—' : `${score}%`
}

export function isPassing(score: number | null | undefined, passMark: number): boolean {
  return score !== null && score !== undefined && score >= passMark
}

export function isValidScore(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100
}

export function averageScore(scores: Array<number | null | undefined>): number | null {
  const valid = scores.filter((score): score is number => typeof score === 'number')
  if (valid.length === 0) return null
  return Math.round(valid.reduce((sum, score) => sum + score, 0) / valid.length)
}
