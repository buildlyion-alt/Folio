'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PaceStatus } from '@/domain/pace'
import { LogProgressDialog } from './LogProgressDialog'

export interface LogPrefill {
  studentId?: string
  subjectId?: string
  paceNumber?: number
  status?: PaceStatus
}

const LogProgressContext = createContext<((prefill?: LogPrefill) => void) | null>(null)

export function LogProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; prefill: LogPrefill; key: number }>({
    open: false,
    prefill: {},
    key: 0
  })
  const open = useCallback((prefill: LogPrefill = {}) => {
    setState((s) => ({ open: true, prefill, key: s.key + 1 }))
  }, [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])
  const value = useMemo(() => open, [open])

  return (
    <LogProgressContext.Provider value={value}>
      {children}
      {/* Remounting per open resets the form to the new prefill. */}
      <LogProgressDialog key={state.key} open={state.open} prefill={state.prefill} onClose={close} />
    </LogProgressContext.Provider>
  )
}

export function useLogProgress(): (prefill?: LogPrefill) => void {
  const open = useContext(LogProgressContext)
  if (!open) throw new Error('useLogProgress must be used inside <LogProgressProvider>')
  return open
}
