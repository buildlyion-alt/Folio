import type { IsoDate } from './dates'
import type { StudentStatus, SubjectSignal } from './health'
import type { PaceStatus } from './pace'

/*
 * Plain, serializable shapes passed from server components to client components.
 * Nothing here carries database handles or secrets.
 */

export interface HouseholdDTO {
  id: string
  name: string
  timezone: string
  passMark: number
  pacesPerYear: number
  schoolYearStart: IsoDate
  hasCustomSchoolYearStart: boolean
  isDemo: boolean
}

export interface SubjectDTO {
  id: string
  name: string
}

export interface ActivePaceDTO {
  recordId: string
  paceNumber: number
  startedOn: IsoDate | null
  /** Started date, or the day it was recorded when the start date is unknown. */
  since: IsoDate
}

export interface CompletedPaceDTO {
  recordId: string
  paceNumber: number
  completedOn: IsoDate
  testScore: number | null
}

export interface EnrollmentDTO {
  enrollmentId: string
  subjectId: string
  subjectName: string
  current: ActivePaceDTO | null
  /** Additional PACEs in progress in the same subject (rare, but allowed). */
  otherActive: number[]
  lastCompleted: CompletedPaceDTO | null
  completedThisWeek: number
  completedThisYear: number
  completedTotal: number
  averageScore: number | null
  signals: SubjectSignal[]
}

export interface ActivityDTO {
  id: string
  kind: 'started' | 'completed' | 'updated' | 'reopened' | 'reset' | 'removed'
  source: 'manual' | 'assistant' | 'onboarding' | 'demo'
  status: PaceStatus | null
  paceNumber: number
  testScore: number | null
  occurredOn: IsoDate
  createdAt: string
  recordId: string | null
  studentId: string
  studentName: string
  subjectId: string
  subjectName: string
}

export interface StudentConcernDTO {
  subjectId: string
  subjectName: string
  signal: SubjectSignal
}

export interface StudentOverviewDTO {
  id: string
  firstName: string
  lastName: string | null
  displayName: string
  initials: string
  level: number | null
  enrollments: EnrollmentDTO[]
  completedThisWeek: number
  completedLastWeek: number
  completedThisYear: number
  completedLast30: number
  averageScore: number | null
  activeCount: number
  lastActivity: ActivityDTO | null
  status: StudentStatus
  concerns: StudentConcernDTO[]
  todos: StudentConcernDTO[]
}

export interface HouseholdTotalsDTO {
  students: number
  enrollments: number
  activePaces: number
  completedThisWeek: number
  completedLastWeek: number
  completedThisYear: number
  averageScore: number | null
  scoredThisYear: number
  concerns: number
}

export interface HouseholdOverviewDTO {
  household: HouseholdDTO
  today: IsoDate
  weekStart: IsoDate
  subjects: SubjectDTO[]
  students: StudentOverviewDTO[]
  totals: HouseholdTotalsDTO
}

export interface RecordDTO {
  id: string
  enrollmentId: string
  studentId: string
  studentName: string
  subjectId: string
  subjectName: string
  paceNumber: number
  status: PaceStatus
  startedOn: IsoDate | null
  completedOn: IsoDate | null
  testScore: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** Minimal roster used by the Log Progress form and the assistant. */
export interface RosterStudentDTO {
  id: string
  firstName: string
  displayName: string
  initials: string
  subjects: Array<{
    subjectId: string
    subjectName: string
    current: ActivePaceDTO | null
    lastCompleted: CompletedPaceDTO | null
  }>
}
