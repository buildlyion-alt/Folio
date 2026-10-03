import type { ReactNode } from 'react'
import { AppProviders } from '@/components/providers/AppProviders'
import { AppShell } from '@/components/shell/AppShell'
import { initials } from '@/domain/format'
import { openAiConfigured, openAiModel } from '@/server/assistant/openai-parser'
import { getCurrentOverview } from '@/server/queries/current'
import { toRoster } from '@/server/queries/overview'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { ctx, overview } = await getCurrentOverview()
  const [first, ...rest] = ctx.user.name.split(/\s+/)
  const aiEnabled = openAiConfigured()

  return (
    <AppProviders
      data={{
        household: overview.household,
        user: { name: ctx.user.name, email: ctx.user.email, initials: initials(first ?? '?', rest.at(-1)) },
        roster: toRoster(overview),
        subjects: overview.subjects,
        today: overview.today,
        assistant: { provider: aiEnabled ? 'openai' : 'offline', model: aiEnabled ? openAiModel() : null }
      }}
    >
      <AppShell>{children}</AppShell>
    </AppProviders>
  )
}
