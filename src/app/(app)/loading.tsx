import { Skeleton } from '@/components/ui/Misc'
import styles from '@/components/ui/States.module.css'

export default function Loading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Loading">
      <Skeleton width={220} height={24} />
      <Skeleton width={320} height={14} />
      <div className={styles.loadingStrip}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={84} />
        ))}
      </div>
      <Skeleton height={320} />
    </div>
  )
}
