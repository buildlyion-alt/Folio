import { DEFAULT_SUBJECTS, SUGGESTED_EXTRA_SUBJECTS } from '@/domain/subjects'
import { isValidPaceNumber } from '@/domain/pace'

export interface StudentDraft {
  key: string
  firstName: string
  lastName: string
  level: string
}

export interface SubjectDraft {
  key: string
  name: string
  enabled: boolean
  suggested: boolean
}

export interface OnboardingDraft {
  step: number
  householdName: string
  students: StudentDraft[]
  subjects: SubjectDraft[]
  /** Raw cell text keyed by `${studentKey}|${subjectKey}`. */
  positions: Record<string, string>
}

let counter = 0
export function newKey(prefix: string): string {
  counter += 1
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${random}-${counter}`
}

export function emptyStudent(): StudentDraft {
  return { key: newKey('st'), firstName: '', lastName: '', level: '' }
}

export function suggestedHouseholdName(userName: string): string {
  const parts = userName.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[parts.length - 1]} Homeschool` : ''
}

export function initialDraft(userName: string): OnboardingDraft {
  return {
    step: 0,
    householdName: suggestedHouseholdName(userName),
    students: [emptyStudent()],
    subjects: [
      ...DEFAULT_SUBJECTS.map((name) => ({ key: newKey('sb'), name, enabled: true, suggested: false })),
      ...SUGGESTED_EXTRA_SUBJECTS.map((name) => ({ key: newKey('sb'), name, enabled: false, suggested: true }))
    ],
    positions: {}
  }
}

export const cellKey = (studentKey: string, subjectKey: string) => `${studentKey}|${subjectKey}`

export function namedStudents(draft: OnboardingDraft): StudentDraft[] {
  return draft.students.filter((s) => s.firstName.trim().length > 0)
}

export function enabledSubjects(draft: OnboardingDraft): SubjectDraft[] {
  return draft.subjects.filter((s) => s.enabled)
}

export type CellState = 'empty' | 'valid' | 'invalid'

export function cellState(raw: string | undefined): CellState {
  const value = (raw ?? '').trim()
  if (!value) return 'empty'
  return /^\d+$/.test(value) && isValidPaceNumber(Number(value)) ? 'valid' : 'invalid'
}

export function storageKey(userId: string): string {
  return `folio:onboarding:${userId}`
}

export function loadDraft(userId: string, userName: string): OnboardingDraft {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (raw) {
      const parsed = JSON.parse(raw) as OnboardingDraft
      if (Array.isArray(parsed.students) && Array.isArray(parsed.subjects) && parsed.positions) {
        return { ...parsed, step: Math.min(parsed.step ?? 0, 3) }
      }
    }
  } catch {
    // Storage unavailable (private mode, blocked) — start fresh.
  }
  return initialDraft(userName)
}

export function saveDraft(userId: string, draft: OnboardingDraft): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(draft))
  } catch {
    // Non-critical: the draft just won't survive a reload.
  }
}

export function clearDraft(userId: string): void {
  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // ignore
  }
}
