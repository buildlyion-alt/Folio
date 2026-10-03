'use client'

import { useId, type ComponentProps, type ReactNode } from 'react'
import { ChevronDown, CircleAlert, type LucideIcon } from 'lucide-react'
import { cx } from '@/lib/cx'
import styles from './Field.module.css'

export interface ControlProps {
  id: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  aside?: ReactNode
  className?: string
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean
  children: (control: ControlProps) => ReactNode
}

/** Label + control + hint/error, wired together with ids for assistive tech. */
export function Field({ label, hint, error, optional, aside, className, hideLabel, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cx(styles.field, className)}>
      <div className={cx(styles.labelRow, hideLabel && 'visually-hidden')}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional ? <span className={styles.optional}> · optional</span> : null}
        </label>
        {aside ? <span className={styles.aside}>{aside}</span> : null}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <CircleAlert aria-hidden strokeWidth={2} />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface InputProps extends ComponentProps<'input'> {
  inputSize?: 'md' | 'lg'
  suffix?: ReactNode
  leadingIcon?: LucideIcon
  /** A short visible label inside the field, e.g. "PACE" where there's no room for a label above. */
  leadingText?: string
  numeric?: boolean
}

export function Input({ inputSize = 'md', suffix, leadingIcon: Icon, leadingText, numeric, className, ...rest }: InputProps) {
  const input = (
    <input
      className={cx(
        styles.control,
        inputSize === 'lg' && styles.lg,
        numeric && styles.numeric,
        Icon && styles.withLeadingIcon,
        leadingText && styles.withLeadingText,
        className
      )}
      {...rest}
    />
  )
  if (!suffix && !Icon && !leadingText) return input
  return (
    <div className={styles.affixWrap}>
      {Icon ? <Icon className={styles.leadingIcon} aria-hidden strokeWidth={1.75} /> : null}
      {leadingText ? (
        <span className={styles.leadingText} aria-hidden>
          {leadingText}
        </span>
      ) : null}
      {input}
      {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
    </div>
  )
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cx(styles.control, styles.textarea, className)} {...rest} />
}

interface SelectProps extends ComponentProps<'select'> {
  inputSize?: 'md' | 'lg'
}

export function Select({ inputSize = 'md', className, children, ...rest }: SelectProps) {
  return (
    <div className={styles.selectWrap}>
      <select className={cx(styles.control, styles.select, inputSize === 'lg' && styles.lg, className)} {...rest}>
        {children}
      </select>
      <ChevronDown className={styles.selectIcon} aria-hidden strokeWidth={1.75} />
    </div>
  )
}

export { styles as fieldStyles }
