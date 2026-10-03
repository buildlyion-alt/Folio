import { redirect } from 'next/navigation'
import { getMembership, getSession } from '@/server/auth/context'

export default async function Root() {
  const session = await getSession()
  if (!session) redirect('/sign-in')
  const membership = await getMembership(session.user.id)
  redirect(membership?.household.onboardedAt ? '/home' : '/onboarding')
}
