import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { SettingsView } from '@/components/settings/SettingsView'
import { PageHeader } from '@/components/ui/Misc'
import { getDb } from '@/server/db'
import { subjects } from '@/server/db/schema'
import { openAiConfigured, openAiModel } from '@/server/assistant/openai-parser'
import { getCurrentOverview } from '@/server/queries/current'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const { ctx, overview } = await getCurrentOverview()
  const db = getDb()
  const subjectRows = await db
    .select({ id: subjects.id, name: subjects.name, archivedAt: subjects.archivedAt })
    .from(subjects)
    .where(eq(subjects.householdId, ctx.household.id))
    .orderBy(asc(subjects.sortOrder), asc(subjects.name))
  const enrolledCounts = new Map<string, number>()
  for (const student of overview.students) {
    for (const e of student.enrollments) enrolledCounts.set(e.subjectId, (enrolledCounts.get(e.subjectId) ?? 0) + 1)
  }

  return (
    <div>
      <PageHeader title="Settings" />
      <SettingsView
        household={overview.household}
        subjects={subjectRows.map((s) => ({ id: s.id, name: s.name, archived: s.archivedAt !== null, students: enrolledCounts.get(s.id) ?? 0 }))}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        timezones={Intl.supportedValuesOf('timeZone')}
        assistant={{ enabled: openAiConfigured(), model: openAiConfigured() ? openAiModel() : null }}
      />
    </div>
  )
}
