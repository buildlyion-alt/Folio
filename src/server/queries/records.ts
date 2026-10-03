import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm'
import * as z from 'zod'
import { isIsoDate } from '@/domain/dates'
import type { RecordDTO } from '@/domain/dto'
import type { DbExecutor } from '../db/client'
import { paceRecords, studentSubjects, students, subjects } from '../db/schema'

/*
 * The searchable academic record — Folio's replacement for the paper file.
 * Filters arrive as URL search params, so every filtered view is linkable and
 * survives refresh; anything malformed is ignored rather than erroring.
 */

const optionalUuid = z.uuid().optional().catch(undefined)
const optionalInt = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional().catch(undefined)
const optionalDate = z
  .string()
  .refine(isIsoDate)
  .optional()
  .catch(undefined)

export const recordFiltersSchema = z.object({
  student: optionalUuid,
  subject: optionalUuid,
  status: z.enum(['not_started', 'active', 'completed']).optional().catch(undefined),
  from: optionalDate,
  to: optionalDate,
  paceMin: optionalInt(1, 9999),
  paceMax: optionalInt(1, 9999),
  scoreMin: optionalInt(0, 100),
  scoreMax: optionalInt(0, 100),
  q: z.string().trim().max(80).optional().catch(undefined),
  sort: z.enum(['date', 'student', 'subject', 'pace', 'score', 'status']).optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  page: optionalInt(1, 10_000)
})

export type RecordFilters = z.output<typeof recordFiltersSchema>

export function parseRecordFilters(params: Record<string, string | string[] | undefined>): RecordFilters {
  const flat: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value
    if (v !== undefined && v !== '') flat[key] = v
  }
  return recordFiltersSchema.parse(flat)
}

export function hasActiveFilters(filters: RecordFilters): boolean {
  const { sort: _sort, dir: _dir, page: _page, ...rest } = filters
  return Object.values(rest).some((value) => value !== undefined)
}

/** The date a record is filed under: completion date, else start date. */
export const recordDate = sql<string>`coalesce(${paceRecords.completedOn}, ${paceRecords.startedOn}, (${paceRecords.createdAt})::date)`

function conditionsFor(householdId: string, filters: RecordFilters): SQL[] {
  const conditions: SQL[] = [eq(paceRecords.householdId, householdId)]
  if (filters.student) conditions.push(eq(studentSubjects.studentId, filters.student))
  if (filters.subject) conditions.push(eq(studentSubjects.subjectId, filters.subject))
  if (filters.status) conditions.push(eq(paceRecords.status, filters.status))
  if (filters.from) conditions.push(sql`${recordDate} >= ${filters.from}::date`)
  if (filters.to) conditions.push(sql`${recordDate} <= ${filters.to}::date`)
  if (filters.paceMin !== undefined) conditions.push(gte(paceRecords.paceNumber, filters.paceMin))
  if (filters.paceMax !== undefined) conditions.push(lte(paceRecords.paceNumber, filters.paceMax))
  if (filters.scoreMin !== undefined) conditions.push(gte(paceRecords.testScore, filters.scoreMin))
  if (filters.scoreMax !== undefined) conditions.push(lte(paceRecords.testScore, filters.scoreMax))
  if (filters.q) {
    const term = `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const numeric = /^\d{1,4}$/.test(filters.q) ? Number(filters.q) : null
    const textMatch = or(
      ilike(students.firstName, term),
      ilike(students.lastName, term),
      ilike(subjects.name, term),
      ilike(paceRecords.notes, term),
      sql`${paceRecords.paceNumber}::text like ${`${filters.q}%`}`
    )!
    conditions.push(numeric !== null ? or(eq(paceRecords.paceNumber, numeric), textMatch)! : textMatch)
  }
  return conditions
}

export const RECORDS_PAGE_SIZE = 50

const recordColumns = {
  id: paceRecords.id,
  enrollmentId: paceRecords.studentSubjectId,
  studentId: students.id,
  studentFirstName: students.firstName,
  studentLastName: students.lastName,
  subjectId: subjects.id,
  subjectName: subjects.name,
  paceNumber: paceRecords.paceNumber,
  status: paceRecords.status,
  startedOn: paceRecords.startedOn,
  completedOn: paceRecords.completedOn,
  testScore: paceRecords.testScore,
  notes: paceRecords.notes,
  createdAt: paceRecords.createdAt,
  updatedAt: paceRecords.updatedAt
}

type RecordRow = {
  id: string
  enrollmentId: string
  studentId: string
  studentFirstName: string
  studentLastName: string | null
  subjectId: string
  subjectName: string
  paceNumber: number
  status: 'not_started' | 'active' | 'completed'
  startedOn: string | null
  completedOn: string | null
  testScore: number | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export function toRecordDTO(row: RecordRow): RecordDTO {
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    studentName: row.studentFirstName,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    paceNumber: row.paceNumber,
    status: row.status,
    startedOn: row.startedOn,
    completedOn: row.completedOn,
    testScore: row.testScore,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function orderFor(filters: RecordFilters): SQL[] {
  const dir = filters.dir === 'asc' ? asc : desc
  switch (filters.sort ?? 'date') {
    case 'student':
      return [dir(students.firstName), desc(recordDate)]
    case 'subject':
      return [dir(subjects.name), desc(recordDate)]
    case 'pace':
      return [dir(paceRecords.paceNumber), asc(students.firstName)]
    case 'score':
      return [sql`${paceRecords.testScore} ${filters.dir === 'asc' ? sql`asc` : sql`desc`} nulls last`, desc(recordDate)]
    case 'status':
      return [dir(paceRecords.status), desc(recordDate)]
    case 'date':
      return [dir(recordDate), desc(paceRecords.updatedAt)]
  }
}

export async function listRecords(
  db: DbExecutor,
  householdId: string,
  filters: RecordFilters,
  options: { pageSize?: number; all?: boolean } = {}
): Promise<{ rows: RecordDTO[]; total: number; page: number; pageCount: number }> {
  const pageSize = options.pageSize ?? RECORDS_PAGE_SIZE
  const where = and(...conditionsFor(householdId, filters))

  const base = db
    .select(recordColumns)
    .from(paceRecords)
    .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(where)
    .orderBy(...orderFor(filters))

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(paceRecords)
    .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(where)

  const count = Number(total)
  const pageCount = Math.max(1, Math.ceil(count / pageSize))
  const page = Math.min(filters.page ?? 1, pageCount)
  const rows = options.all ? await base : await base.limit(pageSize).offset((page - 1) * pageSize)

  return { rows: rows.map(toRecordDTO), total: count, page, pageCount }
}

export async function getRecord(db: DbExecutor, householdId: string, recordId: string): Promise<RecordDTO | null> {
  const [row] = await db
    .select(recordColumns)
    .from(paceRecords)
    .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(and(eq(paceRecords.id, recordId), eq(paceRecords.householdId, householdId)))
  return row ? toRecordDTO(row) : null
}

/** All records for one student, oldest PACE first within each subject. */
export async function listStudentRecords(db: DbExecutor, householdId: string, studentId: string): Promise<RecordDTO[]> {
  const rows = await db
    .select(recordColumns)
    .from(paceRecords)
    .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
    .innerJoin(students, eq(students.id, studentSubjects.studentId))
    .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
    .where(and(eq(paceRecords.householdId, householdId), eq(studentSubjects.studentId, studentId)))
    .orderBy(asc(subjects.sortOrder), asc(paceRecords.paceNumber))
  return rows.map(toRecordDTO)
}
