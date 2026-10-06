import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Landing } from '@/components/marketing/Landing'
import { SESSION_COOKIE } from '@/server/auth/constants'

const description =
  'Folio is a calm record book for homeschool families using the A.C.E. curriculum: every child’s current PACE, PACE Test scores and a permanent history, on your computer or phone.'

export const metadata: Metadata = {
  title: { absolute: 'Folio · PACE records for A.C.E. homeschool families' },
  description,
  openGraph: {
    title: 'Folio · A calmer way to track every PACE',
    description,
    type: 'website'
  }
}

export default async function Root() {
  // Optimistic, like the proxy: a session cookie only changes the calls to action. The app's
  // own pages still validate the session before showing anything.
  const signedIn = (await cookies()).has(SESSION_COOKIE)
  return <Landing signedIn={signedIn} />
}
