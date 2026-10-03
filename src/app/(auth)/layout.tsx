import { Logo } from '@/components/brand/Logo'
import styles from './auth.module.css'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Logo />
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <p>Homeschool records for A.C.E. families. Your records are private to your household.</p>
      </footer>
    </div>
  )
}
