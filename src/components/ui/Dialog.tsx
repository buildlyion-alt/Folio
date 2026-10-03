'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from '@/lib/cx'
import { Button } from './Button'
import styles from './Dialog.module.css'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  footerStart?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** On phones, take the full height (long forms) instead of sizing to content. */
  fullOnMobile?: boolean
  /** Prevent closing via Escape/backdrop (e.g. while saving). */
  locked?: boolean
  className?: string
}

/**
 * Modal built on the native <dialog> element: the browser provides focus trapping,
 * inert background content and Escape handling; React state stays the source of truth.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  footerStart,
  size = 'md',
  fullOnMobile,
  locked,
  className
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const pointerDownOnBackdrop = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      restoreFocus.current = document.activeElement as HTMLElement | null
      dialog.showModal()
      document.documentElement.style.overflow = 'hidden'
      // showModal() would focus the header's Close button; start on the field that matters.
      const preferred =
        dialog.querySelector<HTMLElement>('[data-autofocus]') ??
        dialog.querySelector<HTMLElement>(
          `.${styles.body} :is(input, select, textarea, button, [tabindex="0"]):not(:disabled):not([tabindex="-1"])`
        )
      preferred?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    function handleClose() {
      document.documentElement.style.overflow = ''
      restoreFocus.current?.focus?.()
    }
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('close', handleClose)
      document.documentElement.style.overflow = ''
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size], fullOnMobile && styles.full, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!locked) onClose()
      }}
      onPointerDown={(event) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pointerDownOnBackdrop.current && !locked) onClose()
      }}
    >
      {open ? (
        <>
          <div className={styles.header}>
            <div className={styles.titles}>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" iconOnly icon={X} aria-label="Close" onClick={onClose} disabled={locked} />
          </div>
          <div className={styles.body}>{children}</div>
          {footer ? (
            <div className={styles.footer}>
              {footerStart ? <div className={styles.footerStart}>{footerStart}</div> : null}
              {footer}
            </div>
          ) : null}
        </>
      ) : null}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Explicit confirmation for destructive or record-changing actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  pending,
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      locked={pending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.description}>{description}</div>
    </Dialog>
  )
}
