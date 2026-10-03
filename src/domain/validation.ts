import * as z from 'zod'
import { isIsoDate, isValidTimeZone } from './dates'
import { PACE_MAX, PACE_MIN } from './pace'

/*
 * Input schemas shared by forms (for instant feedback) and server actions (the
 * authoritative check). Server actions never trust these alone for authorization —
 * IDs are always re-checked against the signed-in user's household.
 */

export const isoDateSchema = z.string().refine(isIsoDate, { error: 'Enter a valid date.' })

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }))

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Enter your name.' })
    .max(80, { error: 'Keep your name under 80 characters.' }),
  email: emailSchema,
  password: z
    .string()
    .min(8, { error: 'Use at least 8 characters.' })
    .max(128, { error: 'Use 128 characters or fewer.' })
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Enter your password.' })
})

export const paceNumberSchema = z.coerce
  .number({ error: 'Enter a PACE number.' })
  .int({ error: 'PACE numbers are whole numbers.' })
  .min(PACE_MIN, { error: 'Enter a PACE number.' })
  .max(PACE_MAX, { error: `PACE numbers go up to ${PACE_MAX}.` })

export const testScoreSchema = z.coerce
  .number({ error: 'Enter a score from 0 to 100.' })
  .int({ error: 'Scores are whole numbers.' })
  .min(0, { error: 'Scores can’t be below 0.' })
  .max(100, { error: 'Scores can’t be above 100.' })

export const paceStatusSchema = z.enum(['not_started', 'active', 'completed'])

const notesSchema = z
  .string()
  .trim()
  .max(2000, { error: 'Keep notes under 2,000 characters.' })
  .transform((value) => (value.length ? value : null))
  .nullable()

/** One progress entry — the same shape whether it came from the form or the assistant. */
export const progressEntrySchema = z.object({
  studentId: z.uuid({ error: 'Choose a student.' }),
  subjectId: z.uuid({ error: 'Choose a subject.' }),
  paceNumber: paceNumberSchema,
  status: paceStatusSchema,
  testScore: testScoreSchema.nullable(),
  /** Completion date for completed PACEs, start date for active ones. Ignored when not started. */
  date: isoDateSchema.nullable(),
  notes: notesSchema.optional()
})

export type ProgressEntryInput = z.input<typeof progressEntrySchema>
export type ProgressEntry = z.output<typeof progressEntrySchema>

export const recordUpdateSchema = z.object({
  recordId: z.uuid(),
  paceNumber: paceNumberSchema,
  status: paceStatusSchema,
  startedOn: isoDateSchema.nullable(),
  completedOn: isoDateSchema.nullable(),
  testScore: testScoreSchema.nullable(),
  notes: notesSchema
})

export type RecordUpdate = z.output<typeof recordUpdateSchema>

const personName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Enter a ${label}.` })
    .max(40, { error: `Keep the ${label} under 40 characters.` })

const optionalName = z
  .string()
  .trim()
  .max(40, { error: 'Keep the last name under 40 characters.' })
  .transform((value) => (value.length ? value : null))
  .nullable()

export const levelSchema = z.coerce
  .number()
  .int()
  .min(1, { error: 'Levels run from 1 to 12.' })
  .max(12, { error: 'Levels run from 1 to 12.' })
  .nullable()

export const subjectNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Enter a subject name.' })
  .max(40, { error: 'Keep subject names under 40 characters.' })

export const householdNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Give your homeschool a name.' })
  .max(80, { error: 'Keep the name under 80 characters.' })

export const timezoneSchema = z
  .string()
  .refine(isValidTimeZone, { error: 'Choose a valid time zone.' })

export const onboardingSchema = z
  .object({
    householdName: householdNameSchema,
    timezone: timezoneSchema,
    students: z
      .array(
        z.object({
          key: z.string().min(1).max(64),
          firstName: personName('first name'),
          lastName: optionalName,
          level: levelSchema
        })
      )
      .min(1, { error: 'Add at least one student.' })
      .max(30, { error: 'Folio supports up to 30 students per household.' }),
    subjects: z
      .array(z.object({ key: z.string().min(1).max(64), name: subjectNameSchema }))
      .min(1, { error: 'Choose at least one subject.' })
      .max(20, { error: 'Choose 20 subjects or fewer.' }),
    positions: z
      .array(
        z.object({
          studentKey: z.string().min(1).max(64),
          subjectKey: z.string().min(1).max(64),
          paceNumber: paceNumberSchema
        })
      )
      .max(600)
  })
  .superRefine((value, ctx) => {
    const names = new Set<string>()
    for (const subject of value.subjects) {
      const normalized = subject.name.toLowerCase()
      if (names.has(normalized)) {
        ctx.addIssue({ code: 'custom', message: `“${subject.name}” is listed twice.`, path: ['subjects'] })
      }
      names.add(normalized)
    }
    const studentKeys = new Set(value.students.map((s) => s.key))
    const subjectKeys = new Set(value.subjects.map((s) => s.key))
    const seen = new Set<string>()
    for (const position of value.positions) {
      if (!studentKeys.has(position.studentKey) || !subjectKeys.has(position.subjectKey)) {
        ctx.addIssue({ code: 'custom', message: 'A PACE position refers to a missing student or subject.', path: ['positions'] })
      }
      const pair = `${position.studentKey}:${position.subjectKey}`
      if (seen.has(pair)) {
        ctx.addIssue({ code: 'custom', message: 'A student has two positions for one subject.', path: ['positions'] })
      }
      seen.add(pair)
    }
  })

export type OnboardingInput = z.input<typeof onboardingSchema>
export type OnboardingData = z.output<typeof onboardingSchema>

export const studentFormSchema = z.object({
  firstName: personName('first name'),
  lastName: optionalName,
  level: levelSchema
})

export const newStudentSchema = studentFormSchema.extend({
  enrollments: z
    .array(z.object({ subjectId: z.uuid(), currentPace: paceNumberSchema.nullable() }))
    .max(20)
})

export const householdSettingsSchema = z.object({
  name: householdNameSchema,
  timezone: timezoneSchema,
  passMark: z.coerce
    .number()
    .int()
    .min(50, { error: 'Pass mark must be between 50 and 100.' })
    .max(100, { error: 'Pass mark must be between 50 and 100.' }),
  pacesPerYear: z.coerce
    .number()
    .int()
    .min(1, { error: 'Enter between 1 and 60.' })
    .max(60, { error: 'Enter between 1 and 60.' }),
  schoolYearStart: isoDateSchema.nullable()
})

export const termSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: 'Name the term.' })
      .max(40, { error: 'Keep term names under 40 characters.' }),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema
  })
  .refine((term) => term.endsOn >= term.startsOn, {
    error: 'The term must end after it starts.',
    path: ['endsOn']
  })

/** Field-level error map for forms: { fieldName: firstMessage }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_form'
    if (!(key in result)) result[key] = issue.message
  }
  return result
}
