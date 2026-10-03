import { cx } from '@/lib/cx'
import styles from './Logo.module.css'

/** Folio's mark: a single page with a folded corner — the record a folio holds. */
export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M4 1.25h8.4l6.35 6.35V16A2.75 2.75 0 0 1 16 18.75H4A2.75 2.75 0 0 1 1.25 16V4A2.75 2.75 0 0 1 4 1.25Z" fill="var(--signal)" />
      <path d="M12.4 1.25V5.6a2 2 0 0 0 2 2h4.35" fill="none" stroke="var(--on-signal)" strokeWidth="1.5" />
      <path d="M5 10.5h6.5M5 13.75h9" stroke="var(--on-signal)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span className={cx(styles.logo, className)}>
      <LogoMark size={size} />
      <span className={styles.word}>Folio</span>
    </span>
  )
}
