'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Choice.module.css'

export interface ChoiceOption<T extends string> {
  value: T
  label: ReactNode
  /** Secondary text shown beside the label, e.g. a current PACE number. */
  meta?: ReactNode
  disabled?: boolean
  /** Accessible name when the label isn't plain text. */
  ariaLabel?: string
}

interface ChoiceGroupProps<T extends string> {
  label: string
  value: T | null
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
  variant?: 'chips' | 'segmented'
  block?: boolean
  className?: string
  id?: string
  'aria-describedby'?: string
}

/**
 * A radio group rendered as chips or a segmented control. Follows the WAI-ARIA radio
 * pattern: one tab stop, arrow keys move and select, Home/End jump to the ends.
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = 'chips',
  block,
  className,
  id,
  'aria-describedby': describedBy
}: ChoiceGroupProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const enabled = options.filter((o) => !o.disabled)
  const focusValue = value && options.some((o) => o.value === value && !o.disabled) ? value : enabled[0]?.value

  function move(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    let next = -1
    if (event.key in keys) {
      for (let step = 1; step <= options.length; step++) {
        const candidate = (index + keys[event.key] * step + options.length) % options.length
        if (!options[candidate].disabled) {
          next = candidate
          break
        }
      }
    } else if (event.key === 'Home') {
      next = options.findIndex((o) => !o.disabled)
    } else if (event.key === 'End') {
      next = options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled)
    } else {
      return
    }
    event.preventDefault()
    if (next >= 0) {
      onChange(options[next].value)
      refs.current[next]?.focus()
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      className={cx(variant === 'chips' ? styles.chips : styles.segmented, block && styles.block, className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={option.value === focusValue ? 0 : -1}
            disabled={option.disabled}
            className={variant === 'chips' ? styles.chip : styles.segment}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
          >
            {option.label}
            {option.meta !== undefined ? <span className={styles.chipMeta}>{option.meta}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export { styles as choiceStyles }
