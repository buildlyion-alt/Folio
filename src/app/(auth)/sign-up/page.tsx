import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/AuthForms'
import { getSession } from '@/server/auth/context'
import styles from '../auth.module.css'

export const metadata: Metadata = { title: 'Create account' }

export default async function SignUpPage() {
  if (await getSession()) redirect('/home')
  return (
    <div className={styles.column}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Set up your homeschool in a few minutes. Add every child at once.</p>
      </div>
      <SignUpForm />
    </div>
  )
}
