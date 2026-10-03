/*
 * Minimal fixed-window limiter for sign-in attempts. In-memory, so it's per server
 * process — enough to blunt password guessing on a single instance. A multi-instance
 * deployment should move this to a shared store (Redis, or a Postgres table).
 */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export function consumeAttempt(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const current = windows.get(key)
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }
  current.count += 1
  if (current.count > limit) return { allowed: false, retryAfterMs: current.resetAt - now }
  return { allowed: true, retryAfterMs: 0 }
}

export function resetAttempts(key: string): void {
  windows.delete(key)
}

// Keep the map from growing without bound on a long-running server.
setInterval(() => {
  const now = Date.now()
  for (const [key, window] of windows) if (window.resetAt <= now) windows.delete(key)
}, 10 * 60 * 1000).unref?.()
