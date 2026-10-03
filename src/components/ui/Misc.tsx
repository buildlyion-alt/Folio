import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { StudentStatus } from '@/domain/health'
import { STUDENT_STATUS_LABEL } from '@/domain/health'
import { hashBucket } from '@/domain/format'
import { cx } from '@/lib/cx'
import styles from './Misc.module.css'

export function Avatar({
  initials,
  seed,
  size = 'md',
  className
}: {
  initials: string
  seed?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const tone = styles[`tone${hashBucket(seed ?? initials, 4)}`]
  return (
    <span className={cx(styles.avatar, styles[size], tone, className)} aria-hidden>
      {initials}
    </span>
  )
}

export function StatusDot({ tone }: { tone: 'signal' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <span
      className={cx(
        styles.dot,
        tone === 'signal' && styles.dotSignal,
        tone === 'warning' && styles.dotWarning,
        tone === 'danger' && styles.dotDanger
      )}
      aria-hidden
    />
  )
}

export function StudentStatusLabel({ status }: { status: StudentStatus }) {
  // Normal is quiet; only exceptions carry color, so they stand out in a long list.
  const tone = status === 'attention' ? 'warning' : 'neutral'
  return (
    <span className={cx(styles.status, tone === 'warning' && styles.statusWarning)}>
      <StatusDot tone={tone} />
      {STUDENT_STATUS_LABEL[status]}
    </span>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  className
}: {
  children: ReactNode
  tone?: 'neutral' | 'signal' | 'warning' | 'danger'
  icon?: LucideIcon
  className?: string
}) {
  return (
    <span
      className={cx(
        styles.badge,
        tone === 'signal' && styles.badgeSignal,
        tone === 'warning' && styles.badgeWarning,
        tone === 'danger' && styles.badgeDanger,
        className
      )}
    >
      {Icon ? <Icon aria-hidden strokeWidth={2} /> : null}
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>
}

export function Skeleton({ width, height = 12, className }: { width?: number | string; height?: number; className?: string }) {
  return <span className={cx(styles.skeleton, className)} style={{ width, height }} aria-hidden />
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
  compact
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  actions?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={cx(styles.empty, compact && styles.emptyCompact)}>
      <span className={styles.emptyIcon} aria-hidden>
        <Icon strokeWidth={1.75} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {children ? <div className={styles.emptyText}>{children}</div> : null}
      {actions ? <div className={styles.emptyActions}>{actions}</div> : null}
    </div>
  )
}

export function Panel({
  title,
  meta,
  actions,
  children,
  bodyClassName,
  className,
  flush,
  as: Tag = 'section',
  id
}: {
  title?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  bodyClassName?: string
  className?: string
  /** No body padding — for tables and lists that run edge to edge. */
  flush?: boolean
  as?: 'section' | 'div'
  id?: string
}) {
  return (
    <Tag className={cx(styles.panel, className)} id={id}>
      {title ? (
        <header className={styles.panelHeader}>
          <div className={styles.panelTitles}>
            <h2 className={styles.panelTitle}>{title}</h2>
            {meta ? <span className={styles.panelMeta}>{meta}</span> : null}
          </div>
          {actions ? <div className={styles.panelActions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx(!flush && styles.panelBody, bodyClassName)}>{children}</div>
    </Tag>
  )
}

/** The trail back from a deep page: "Students /" or "Reports / Weekly progress". */
export function Breadcrumb({ trail, current }: { trail: Array<{ href: string; label: string }>; current?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      {trail.map((crumb) => (
        <Fragment key={crumb.href}>
          <Link href={crumb.href}>{crumb.label}</Link>
          <span aria-hidden>/</span>
        </Fragment>
      ))}
      {current ? <span aria-current="page">{current}</span> : null}
    </nav>
  )
}

export function PageHeader({
  title,
  breadcrumb,
  description,
  actions
}: {
  title: ReactNode
  /** Deep pages only: the trail back to the parent list ("Students /"). */
  breadcrumb?: Array<{ href: string; label: string }>
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageTitles}>
        {breadcrumb?.length ? <Breadcrumb trail={breadcrumb} /> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  )
}

export function SectionHeading({ title, meta, id }: { title: ReactNode; meta?: ReactNode; id?: string }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle} id={id}>
        {title}
      </h2>
      {meta ? <span className={styles.sectionMeta}>{meta}</span> : null}
    </div>
  )
}
