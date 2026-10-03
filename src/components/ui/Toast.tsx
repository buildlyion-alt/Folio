'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, CircleAlert, Info, X } from 'lucide-react'
import { cx } from '@/lib/cx'
import styles from './Toast.module.css'

type Tone = 'success' | 'error' | 'info'

export interface ToastInput {
  title: string
  description?: string
  tone?: Tone
  action?: { label: string; href?: string; onClick?: () => void }
  durationMs?: number
}

interface ToastItem extends ToastInput {
  id: number
}

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismiss(id), toast.durationMs ?? (toast.tone === 'error' ? 8000 : 5000))
    },
    [dismiss]
  )

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="region" aria-label="Notifications">
        {toasts.map((toast) => {
          const tone = toast.tone ?? 'success'
          const Icon = tone === 'success' ? Check : tone === 'error' ? CircleAlert : Info
          return (
            <div key={toast.id} className={cx(styles.toast, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
              <Icon className={styles.icon} aria-hidden strokeWidth={2} />
              <div className={styles.content}>
                <p className={styles.title}>{toast.title}</p>
                {toast.description ? <p className={styles.description}>{toast.description}</p> : null}
                {toast.action ? (
                  toast.action.href ? (
                    <Link className={styles.action} href={toast.action.href} onClick={() => dismiss(toast.id)}>
                      {toast.action.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => {
                        toast.action?.onClick?.()
                        dismiss(toast.id)
                      }}
                    >
                      {toast.action.label}
                    </button>
                  )
                ) : null}
              </div>
              <button type="button" className={styles.close} aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
                <X aria-hidden strokeWidth={1.75} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
