import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import styles from '@/components/ui/States.module.css'

export default function NotFound() {
  return (
    <div className={styles.notFound}>
      <Logo />
      <h1 className={styles.notFoundTitle}>That page isn’t here</h1>
      <p className={styles.notFoundText}>The link may be old, or the record may have been deleted.</p>
      <Link href="/home" className={styles.notFoundLink}>
        Back to Home
      </Link>
    </div>
  )
}
