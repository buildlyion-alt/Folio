import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as z from 'zod'
import { StudentProfile } from '@/components/students/StudentProfile'
import { getDb } from '@/server/db'
import { getCurrentOverview } from '@/server/queries/current'
import { getHouseholdOverview } from '@/server/queries/overview'
import { listStudentRecords } from '@/server/queries/records'

export async function generateMetadata(props: PageProps<'/students/[studentId]'>): Promise<Metadata> {
  const { studentId } = await props.params
  const { overview } = await getCurrentOverview()
  const student = overview.students.find((s) => s.id === studentId)
  return { title: student?.displayName ?? 'Student' }
}

export default async function StudentPage(props: PageProps<'/students/[studentId]'>) {
  const { studentId } = await props.params
  const params = await props.searchParams
  if (!z.uuid().safeParse(studentId).success) notFound()

  const { ctx, overview } = await getCurrentOverview()
  const db = getDb()
  let student = overview.students.find((s) => s.id === studentId)
  let archived = false
  if (!student) {
    // Archived students aren't in the main overview; load them on their own.
    const scoped = await getHouseholdOverview(db, ctx.household, { studentIds: [studentId], includeArchivedStudents: true })
    student = scoped.students[0]
    archived = true
    if (!student) notFound()
  }

  const records = await listStudentRecords(db, ctx.household.id, studentId)
  const enrolledIds = new Set(student.enrollments.map((e) => e.subjectId))

  return (
    <StudentProfile
      student={student}
      records={records}
      today={overview.today}
      passMark={overview.household.passMark}
      archived={archived}
      highlightSubject={typeof params.subject === 'string' ? params.subject : null}
      availableSubjects={overview.subjects.filter((s) => !enrolledIds.has(s.id))}
    />
  )
}
