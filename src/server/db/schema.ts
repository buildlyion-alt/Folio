import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'

/*
 * Folio's data model.
 *
 *   users ─< household_members >─ households
 *                                    │
 *              ┌─────────────────────┼──────────────────────┐
 *           students              subjects            academic_terms
 *              └──────< student_subjects >──────┘
 *                            │
 *                       pace_records   (one row per PACE per enrollment — the record of truth)
 *                            │
 *                     progress_events  (append-only audit trail of every change)
 *
 * Every academic table carries household_id. Child tables reference their parents
 * through composite (id, household_id) foreign keys, so the database itself
 * guarantees a PACE record can never point at a student or subject from another
 * household — authorization bugs in application code can't corrupt tenancy.
 */

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date())

export const paceStatusEnum = pgEnum('pace_status', ['not_started', 'active', 'completed'])
export const memberRoleEnum = pgEnum('member_role', ['owner', 'educator'])
export const progressEventKindEnum = pgEnum('progress_event_kind', [
  'started',
  'completed',
  'updated',
  'reopened',
  'reset',
  'removed'
])
export const progressSourceEnum = pgEnum('progress_source', [
  'manual',
  'assistant',
  'onboarding',
  'demo'
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt,
    updatedAt
  },
  (t) => [uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`)]
)

export const sessions = pgTable(
  'sessions',
  {
    // SHA-256 of the cookie token. The raw token only ever lives in the browser cookie.
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
)

export const households = pgTable(
  'households',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    // IANA zone used to decide what "today" and "this week" mean for this family.
    timezone: text('timezone').notNull().default('UTC'),
    // A.C.E. students must reach the pass mark on a PACE Test to move on.
    passMark: smallint('pass_mark').notNull().default(80),
    // Target PACEs per subject per school year (A.C.E. standard is 12).
    pacesPerYear: smallint('paces_per_year').notNull().default(12),
    schoolYearStart: date('school_year_start', { mode: 'string' }),
    // Seeded demo households are flagged so they can be wiped without touching real families.
    isDemo: boolean('is_demo').notNull().default(false),
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (t) => [
    check('households_pass_mark_range', sql`${t.passMark} between 50 and 100`),
    check('households_paces_per_year_range', sql`${t.pacesPerYear} between 1 and 60`)
  ]
)

export const householdMembers = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('owner'),
    createdAt
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.userId] }),
    index('household_members_user_idx').on(t.userId)
  ]
)

export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name'),
    // Optional A.C.E. level (1–12); informational only.
    level: smallint('level'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (t) => [
    unique('students_id_household_unique').on(t.id, t.householdId),
    index('students_household_idx').on(t.householdId),
    check('students_level_range', sql`${t.level} is null or ${t.level} between 1 and 12`)
  ]
)

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (t) => [
    unique('subjects_id_household_unique').on(t.id, t.householdId),
    uniqueIndex('subjects_household_name_idx').on(t.householdId, sql`lower(${t.name})`)
  ]
)

// A student taking a subject. Archiving an enrollment hides it without losing history.
export const studentSubjects = pgTable(
  'student_subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    studentId: uuid('student_id').notNull(),
    subjectId: uuid('subject_id').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt
  },
  (t) => [
    unique('student_subjects_student_subject_unique').on(t.studentId, t.subjectId),
    unique('student_subjects_id_household_unique').on(t.id, t.householdId),
    foreignKey({
      name: 'student_subjects_student_fk',
      columns: [t.studentId, t.householdId],
      foreignColumns: [students.id, students.householdId]
    }).onDelete('cascade'),
    foreignKey({
      name: 'student_subjects_subject_fk',
      columns: [t.subjectId, t.householdId],
      foreignColumns: [subjects.id, subjects.householdId]
    }).onDelete('cascade'),
    index('student_subjects_household_idx').on(t.householdId)
  ]
)

// The canonical academic record: one row per PACE per student-subject.
export const paceRecords = pgTable(
  'pace_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull(),
    studentSubjectId: uuid('student_subject_id').notNull(),
    paceNumber: smallint('pace_number').notNull(),
    status: paceStatusEnum('status').notNull(),
    startedOn: date('started_on', { mode: 'string' }),
    completedOn: date('completed_on', { mode: 'string' }),
    testScore: smallint('test_score'),
    notes: text('notes'),
    createdAt,
    updatedAt
  },
  (t) => [
    unique('pace_records_enrollment_pace_unique').on(t.studentSubjectId, t.paceNumber),
    foreignKey({
      name: 'pace_records_enrollment_fk',
      columns: [t.studentSubjectId, t.householdId],
      foreignColumns: [studentSubjects.id, studentSubjects.householdId]
    }).onDelete('cascade'),
    index('pace_records_household_status_idx').on(t.householdId, t.status),
    index('pace_records_household_completed_idx').on(t.householdId, t.completedOn),
    check('pace_records_pace_number_range', sql`${t.paceNumber} between 1 and 9999`),
    check(
      'pace_records_score_range',
      sql`${t.testScore} is null or ${t.testScore} between 0 and 100`
    ),
    check(
      'pace_records_completed_has_date',
      sql`(${t.status} = 'completed') = (${t.completedOn} is not null)`
    ),
    check(
      'pace_records_score_only_when_completed',
      sql`${t.testScore} is null or ${t.status} = 'completed'`
    ),
    check(
      'pace_records_not_started_has_no_start',
      sql`${t.status} <> 'not_started' or ${t.startedOn} is null`
    ),
    check(
      'pace_records_dates_ordered',
      sql`${t.startedOn} is null or ${t.completedOn} is null or ${t.completedOn} >= ${t.startedOn}`
    )
  ]
)

/** Values of a PACE record captured before a change, for the audit trail. */
export interface PaceSnapshot {
  status: 'not_started' | 'active' | 'completed'
  startedOn: string | null
  completedOn: string | null
  testScore: number | null
  notes: string | null
}

// Append-only history. Powers the activity feed and records who changed what, when, and how.
export const progressEvents = pgTable(
  'progress_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    studentSubjectId: uuid('student_subject_id').notNull(),
    paceRecordId: uuid('pace_record_id').references(() => paceRecords.id, {
      onDelete: 'set null'
    }),
    paceNumber: smallint('pace_number').notNull(),
    kind: progressEventKindEnum('kind').notNull(),
    // Resulting state after the change (null when the record was removed).
    status: paceStatusEnum('status'),
    testScore: smallint('test_score'),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    source: progressSourceEnum('source').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    previous: jsonb('previous').$type<PaceSnapshot>(),
    createdAt
  },
  (t) => [
    foreignKey({
      name: 'progress_events_enrollment_fk',
      columns: [t.studentSubjectId, t.householdId],
      foreignColumns: [studentSubjects.id, studentSubjects.householdId]
    }).onDelete('cascade'),
    index('progress_events_household_created_idx').on(t.householdId, t.createdAt),
    index('progress_events_record_idx').on(t.paceRecordId)
  ]
)

export const academicTerms = pgTable(
  'academic_terms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    createdAt,
    updatedAt
  },
  (t) => [
    index('academic_terms_household_idx').on(t.householdId),
    check('academic_terms_dates_ordered', sql`${t.endsOn} >= ${t.startsOn}`)
  ]
)

export type User = typeof users.$inferSelect
export type Household = typeof households.$inferSelect
export type Student = typeof students.$inferSelect
export type Subject = typeof subjects.$inferSelect
export type StudentSubject = typeof studentSubjects.$inferSelect
export type PaceRecord = typeof paceRecords.$inferSelect
export type ProgressEvent = typeof progressEvents.$inferSelect
export type AcademicTerm = typeof academicTerms.$inferSelect
export type PaceStatus = (typeof paceStatusEnum.enumValues)[number]
export type ProgressSource = (typeof progressSourceEnum.enumValues)[number]
export type ProgressEventKind = (typeof progressEventKindEnum.enumValues)[number]
