export function fullName(firstName: string, lastName: string | null | undefined): string {
  return lastName ? `${firstName} ${lastName}` : firstName
}

export function initials(firstName: string, lastName?: string | null): string {
  const first = firstName.trim().charAt(0)
  const last = lastName?.trim().charAt(0) ?? ''
  return (first + last).toUpperCase() || '?'
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** "Rachel Carter" → "Rachel". */
export function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

export function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}

/** Joins ["a", "b", "c"] → "a, b and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Deterministic 0–(buckets-1) bucket for a string — used for subtle avatar tone variation. */
export function hashBucket(value: string, buckets: number): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash) % buckets
}
