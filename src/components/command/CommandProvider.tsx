'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { CommandBar } from './CommandBar'

const CommandContext = createContext<((initialQuery?: string) => void) | null>(null)

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable))
}

export function CommandProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ open: false, key: 0, initial: '' })

  const open = useCallback((initialQuery = '') => {
    setState((s) => ({ open: true, key: s.key + 1, initial: initialQuery }))
  }, [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setState((s) => (s.open ? { ...s, open: false } : { open: true, key: s.key + 1, initial: '' }))
      } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !isTyping(event.target) && !document.querySelector('dialog[open]')) {
        event.preventDefault()
        setState((s) => ({ open: true, key: s.key + 1, initial: '' }))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <CommandContext.Provider value={open}>
      {children}
      <CommandBar key={state.key} open={state.open} initialQuery={state.initial} onClose={close} />
    </CommandContext.Provider>
  )
}

export function useCommandBar(): (initialQuery?: string) => void {
  const open = useContext(CommandContext)
  if (!open) throw new Error('useCommandBar must be used inside <CommandProvider>')
  return open
}
