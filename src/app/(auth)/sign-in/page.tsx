import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignInForm } from '@/components/auth/AuthForms'
import { getSession } from '@/server/auth/context'
import { DEMO_CREDENTIALS } from '@/server/demo'
import styles from '../auth.module.css'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage(props: PageProps<'/sign-in'>) {
  if (await getSession()) redirect('/home')
  const params = await props.searchParams
  const next = typeof params.next === 'string' ? params.next : undefined
  const demo = process.env.FOLIO_DEMO_LOGIN === '1' && process.env.NODE_ENV !== 'production' ? DEMO_CREDENTIALS : null

  return (
    <div className={styles.column}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Every child’s PACEs, scores and records in one place.</p>
      </div>
      <SignInForm next={next} demo={demo} />
    </div>
  )
}
