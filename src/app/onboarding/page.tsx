import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getMembership, requireSession } from '@/server/auth/context'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const metadata: Metadata = { title: 'Set up your homeschool' }

export default async function OnboardingPage() {
  const session = await requireSession()
  const membership = await getMembership(session.user.id)
  if (membership?.household.onboardedAt) redirect('/home')

  return <OnboardingWizard userId={session.user.id} userName={session.user.name} />
}
