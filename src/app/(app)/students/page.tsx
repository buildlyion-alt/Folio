import type { Metadata } from 'next'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { StudentsDirectory } from '@/components/students/StudentsDirectory'
import { getDb } from '@/server/db'
import { students } from '@/server/db/schema'
import { getCurrentOverview } from '@/server/queries/current'

export const metadata: Metadata = { title: 'Students' }

export default async function StudentsPage(props: PageProps<'/students'>) {
  const { ctx, overview } = await getCurrentOverview()
  const params = await props.searchParams
  const archived = await getDb()
    .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
    .from(students)
    .where(and(eq(students.householdId, ctx.household.id), isNotNull(students.archivedAt)))
    .orderBy(asc(students.firstName))

  return (
    <StudentsDirectory
      students={overview.students}
      today={overview.today}
      passMark={overview.household.passMark}
      archived={archived}
      openNew={params.new === '1'}
    />
  )
}
