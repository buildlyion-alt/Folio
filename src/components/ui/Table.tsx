import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cx } from '@/lib/cx'
import styles from './Table.module.css'

export { styles as tableStyles }

interface SortableThProps {
  label: ReactNode
  active: boolean
  direction: 'asc' | 'desc'
  href?: string
  onClick?: () => void
  align?: 'start' | 'end'
  className?: string
}

/** Column header that sorts. Announces the current order via aria-sort. */
export function SortableTh({ label, active, direction, href, onClick, align = 'start', className }: SortableThProps) {
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  const content = (
    <>
      {label}
      <Icon aria-hidden strokeWidth={2} />
    </>
  )
  return (
    <th
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cx(active && styles.sorted, align === 'end' && cx(styles.num, styles.alignEnd), className)}
      scope="col"
    >
      {href ? (
        <Link href={href} className={styles.sortButton} scroll={false} replace>
          {content}
        </Link>
      ) : (
        <button type="button" className={styles.sortButton} onClick={onClick}>
          {content}
        </button>
      )}
    </th>
  )
}
