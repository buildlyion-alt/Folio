'use client'

import { useSyncExternalStore } from 'react'
import { readThemePreference, setThemePreference, type ResolvedTheme, type ThemePreference } from './theme'

const PREFERENCE_EVENT = 'folio-theme-change'

function subscribeResolved(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

function subscribePreference(onChange: () => void) {
  window.addEventListener(PREFERENCE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The theme currently on screen. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribeResolved,
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
    () => 'light'
  )
}

/** The parent's saved choice — 'system' unless they picked one — and a setter. */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribePreference, readThemePreference, () => 'system' as const)
  const update = (next: ThemePreference) => {
    setThemePreference(next)
    window.dispatchEvent(new Event(PREFERENCE_EVENT))
  }
  return [preference, update]
}
