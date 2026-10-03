export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'folio-theme'

/**
 * Runs in <head> before first paint, so a dark-mode visitor never sees a light flash.
 * Follows the device unless the parent picked a theme, and keeps following it live.
 */
export const themeBootScript = `(function(){try{var k='${THEME_STORAGE_KEY}',m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var t=p==='light'||p==='dark'?p:(m.matches?'dark':'light');document.documentElement.setAttribute('data-theme',t)}a();m.addEventListener('change',a)}catch(e){}})();`

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode); the choice still applies to this page.
  }
  document.documentElement.setAttribute('data-theme', resolveTheme(preference))
}
