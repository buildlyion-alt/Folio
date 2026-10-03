'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '@/lib/cx'
import styles from './Menu.module.css'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  href?: string
  onSelect?: () => void
  danger?: boolean
  separatorBefore?: boolean
}

interface TriggerProps {
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string
  onClick: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

interface MenuProps {
  trigger: (props: TriggerProps) => ReactNode
  items: MenuItem[]
  header?: ReactNode
  side?: 'bottom' | 'top'
  align?: 'start' | 'end' | 'stretch'
  block?: boolean
  label: string
}

/** Menu button (WAI-ARIA pattern): arrow keys move, Escape closes and returns focus. */
export function Menu({ trigger, items, header, side = 'bottom', align = 'start', block, label }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    requestAnimationFrame(() => itemRefs.current[0]?.focus())
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close(refocus = true) {
    setOpen(false)
    if (refocus) rootRef.current?.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(menuId)}"]`)?.focus()
  }

  function onMenuKeyDown(event: KeyboardEvent) {
    const elements = itemRefs.current.filter(Boolean) as HTMLElement[]
    const index = elements.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      elements[(index + 1) % elements.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      elements[(index - 1 + elements.length) % elements.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      elements[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      elements[elements.length - 1]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div ref={rootRef} className={cx(styles.root, block && styles.block)}>
      {trigger({
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
        onClick: () => setOpen((value) => !value),
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }
      })}
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cx(styles.menu, styles[side], styles[align])}
          onKeyDown={onMenuKeyDown}
        >
          {header ? <div className={styles.header}>{header}</div> : null}
          {items.map((item, index) => {
            const content = (
              <>
                {item.icon ? <item.icon aria-hidden strokeWidth={1.75} /> : null}
                {item.label}
              </>
            )
            const common = {
              role: 'menuitem' as const,
              tabIndex: -1,
              className: cx(styles.item, item.danger && styles.danger),
              ref: (el: HTMLElement | null) => {
                itemRefs.current[index] = el
              }
            }
            return (
              <div key={item.label}>
                {item.separatorBefore ? <div className={styles.separator} role="separator" /> : null}
                {item.href ? (
                  <Link href={item.href} {...common} onClick={() => close(false)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    {...common}
                    onClick={() => {
                      close(false)
                      item.onSelect?.()
                    }}
                  >
                    {content}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
