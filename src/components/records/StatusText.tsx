import type { RecordDTO } from '@/domain/dto'
import { PACE_STATUS_LABEL } from '@/domain/pace'
import { cx } from '@/lib/cx'
import styles from './StatusText.module.css'

/** Completed (filled), Active (ring), Not started (hairline) — shape and word, never color alone. */
export function StatusText({ status }: { status: RecordDTO['status'] }) {
  return (
    <span className={cx(styles.status, styles[status])}>
      <span className={styles.dot} aria-hidden />
      {PACE_STATUS_LABEL[status]}
    </span>
  )
}
