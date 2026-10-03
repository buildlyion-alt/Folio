import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { AssistantComposer } from '@/components/assistant/AssistantComposer'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { PageHeader, Panel } from '@/components/ui/Misc'
import { addMonths, formatMonth, startOfMonth } from '@/domain/dates'
import { getDb } from '@/server/db'
import { openAiConfigured, openAiModel } from '@/server/assistant/openai-parser'
import { getRecentActivity } from '@/server/queries/activity'
import { getCurrentOverview } from '@/server/queries/current'
import styles from '@/components/assistant/AssistantPage.module.css'

export const metadata: Metadata = { title: 'AI Assistant' }

export default async function AssistantPage() {
  const { ctx, overview } = await getCurrentOverview()
  const assistantEntries = await getRecentActivity(getDb(), ctx.household.id, { limit: 8, excludeSources: ['manual', 'onboarding', 'demo'] })
  const ai = openAiConfigured()

  // Examples use the family's own names and current PACEs, so they work as typed.
  // Early in a month, the summary worth asking for is last month's.
  const reportMonth = Number(overview.today.slice(8, 10)) <= 7 ? addMonths(startOfMonth(overview.today), -1) : startOfMonth(overview.today)
  const first = overview.students[0]
  const second = overview.students[1] ?? first
  const subjectA = first?.enrollments.find((e) => e.current)
  const subjectB = second?.enrollments.find((e) => e.current)
  const examples = [
    first && subjectA?.current
      ? `${first.firstName} completed ${subjectA.subjectName} ${subjectA.current.paceNumber} today with 94% and started ${subjectA.current.paceNumber + 1}`
      : 'Gabriel completed Math 1084 today with 94% and started 1085',
    second && subjectB?.current ? `${second.firstName} finished ${subjectB.subjectName} ${subjectB.current.paceNumber} yesterday, scored 88` : 'Sarah finished English 1078 yesterday, scored 88',
    'Who completed PACEs this week?',
    'Show scores below 80%',
    second ? `Show me ${second.firstName}’s ${subjectB?.subjectName ?? 'Science'} progress` : 'Show me Sarah’s Science progress',
    `Generate ${formatMonth(reportMonth).split(' ')[0]}’s progress summary`
  ]

  return (
    <div className={styles.page}>
      <PageHeader
        title="AI Assistant"
        description="Say what happened in plain words. Folio turns it into records — and nothing is saved until you confirm."
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.composer} aria-label="Tell Folio what happened">
            <AssistantComposer size="lg" autoFocus examples={examples} placeholder="e.g. “Gabriel completed Math 1084 with 94% and started 1085”" />
            <p className={styles.status}>
              <span className={ai ? styles.dotOn : styles.dotOff} aria-hidden />
              {ai
                ? `Using OpenAI (${openAiModel()}) to read entries, with Folio’s offline parser as a fallback.`
                : 'Using Folio’s offline parser. Add an OPENAI_API_KEY on the server to enable AI reading — entries work either way.'}
            </p>
          </section>
          <ActivityFeed items={assistantEntries} today={overview.today} title="Saved through the assistant" />
        </div>

        <Panel title="How it works" className={styles.aside}>
          <ol className={styles.steps}>
            <li>
              <strong>Folio reads your sentence</strong> — students, subjects, PACE numbers, scores and dates.
            </li>
            <li>
              <strong>Every change is checked against your records.</strong> Unusual PACE numbers, low scores and
              overwrites are flagged before you see them.
            </li>
            <li>
              <strong>You confirm, edit or cancel.</strong> Only confirmed changes are written, through the same
              rules as the Log Progress form, and marked “via assistant” in the history.
            </li>
          </ol>
          <p className={styles.privacy}>
            <ShieldCheck aria-hidden strokeWidth={1.75} />
            {ai
              ? 'With AI enabled, only the sentence you type and your students’ first names and subject names are sent to OpenAI. Scores and records never leave Folio.'
              : 'Nothing you type leaves Folio while the offline parser is in use.'}
          </p>
        </Panel>
      </div>
    </div>
  )
}
