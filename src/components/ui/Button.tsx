import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '@/lib/cx'
import styles from './Button.module.css'

/** primary: the green signal action (one per screen) · ink: a page's own main action · secondary · ghost · danger */
export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface StyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  trailingIcon?: LucideIcon
  /** Icon-only buttons must pass an aria-label. */
  iconOnly?: boolean
  block?: boolean
}

export function buttonClass({
  variant = 'secondary',
  size = 'md',
  iconOnly,
  block,
  className
}: StyleProps & { className?: string }): string {
  return cx(
    styles.button,
    styles[variant],
    size !== 'md' && styles[size],
    iconOnly && styles.iconOnly,
    block && styles.block,
    className
  )
}

function Content({
  icon: Icon,
  trailingIcon: Trailing,
  children
}: {
  icon?: LucideIcon
  trailingIcon?: LucideIcon
  children?: ReactNode
}) {
  return (
    <>
      {Icon ? <Icon aria-hidden strokeWidth={1.75} /> : null}
      {children}
      {Trailing ? <Trailing aria-hidden strokeWidth={1.75} /> : null}
    </>
  )
}

export interface ButtonProps extends StyleProps, ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
}

export function Button({
  variant,
  size,
  icon,
  trailingIcon,
  iconOnly,
  block,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, iconOnly, block, className: cx(loading && styles.loading, className) })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon} trailingIcon={trailingIcon}>
        {children}
      </Content>
      {loading ? <span className={styles.spinner} aria-hidden /> : null}
    </button>
  )
}

export interface ButtonLinkProps extends StyleProps, Omit<ComponentProps<typeof Link>, 'className'> {
  className?: string
}

export function ButtonLink({
  variant,
  size,
  icon,
  trailingIcon,
  iconOnly,
  block,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, iconOnly, block, className })} {...rest}>
      <Content icon={icon} trailingIcon={trailingIcon}>
        {children}
      </Content>
    </Link>
  )
}
