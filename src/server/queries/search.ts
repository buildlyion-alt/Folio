import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import { fullName, initials } from '@/domain/format'
import type { DbExecutor } from '../db/client'
import { paceRecords, studentSubjects, students, subjects } from '../db/schema'
import { recordDate } from './records'

export interface SearchResults {
  students: Array<{ id: string; name: string; initials: string; level: number | null }>
  subjects: Array<{ id: string; name: string }>
  records: Array<{
    id: string
    studentId: string
    studentName: string
    subjectId: string
    subjectName: string
    paceNumber: number
    status: 'not_started' | 'active' | 'completed'
    testScore: number | null
    completedOn: string | null
    startedOn: string | null
  }>
}

function like(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * Global search: "Gabriel", "1084", "Mathematics", or combinations like
 * "gabriel 1084". Every word must match; numbers match PACE numbers by prefix.
 */
export async function searchHousehold(db: DbExecutor, householdId: string, query: string): Promise<SearchResults> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { students: [], subjects: [], records: [] }
  const numbers = words.filter((w) => /^\d{1,4}$/.test(w))
  const terms = words.filter((w) => !/^\d+$/.test(w)).map((w) => w.replace(/'s$/, ''))

  const studentRows =
    terms.length && numbers.length === 0
      ? await db
          .select({ id: students.id, firstName: students.firstName, lastName: students.lastName, level: students.level })
          .from(students)
          .where(
            and(
              eq(students.householdId, householdId),
              isNull(students.archivedAt),
              ...terms.map((t) => or(ilike(students.firstName, like(t)), ilike(students.lastName, like(t)))!)
            )
          )
          .orderBy(asc(students.sortOrder))
          .limit(6)
      : []

  const subjectRows =
    terms.length && numbers.length === 0
      ? await db
          .select({ id: subjects.id, name: subjects.name })
          .from(subjects)
          .where(
            and(
              eq(subjects.householdId, householdId),
              isNull(subjects.archivedAt),
              ...terms.map((t) => ilike(subjects.name, like(t)))
            )
          )
          .orderBy(asc(subjects.sortOrder))
          .limit(4)
      : []

  let recordRows: SearchResults['records'] = []
  if (numbers.length > 0) {
    const conditions: SQL[] = [eq(paceRecords.householdId, householdId)]
    for (const n of numbers) conditions.push(sql`${paceRecords.paceNumber}::text like ${`${n}%`}`)
    for (const t of terms) {
      conditions.push(or(ilike(students.firstName, like(t)), ilike(students.lastName, like(t)), ilike(subjects.name, like(t)))!)
    }
    const rows = await db
      .select({
        id: paceRecords.id,
        studentId: students.id,
        studentName: students.firstName,
        subjectId: subjects.id,
        subjectName: subjects.name,
        paceNumber: paceRecords.paceNumber,
        status: paceRecords.status,
        testScore: paceRecords.testScore,
        completedOn: paceRecords.completedOn,
        startedOn: paceRecords.startedOn
      })
      .from(paceRecords)
      .innerJoin(studentSubjects, eq(studentSubjects.id, paceRecords.studentSubjectId))
      .innerJoin(students, eq(students.id, studentSubjects.studentId))
      .innerJoin(subjects, eq(subjects.id, studentSubjects.subjectId))
      .where(and(...conditions))
      .orderBy(desc(recordDate))
      .limit(8)
    recordRows = rows
  }

  return {
    students: studentRows.map((s) => ({
      id: s.id,
      name: fullName(s.firstName, s.lastName),
      initials: initials(s.firstName, s.lastName),
      level: s.level
    })),
    subjects: subjectRows,
    records: recordRows
  }
}
