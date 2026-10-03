import { normalizeSubjectName, subjectAliasesFor } from '@/domain/subjects'
import type { AssistantContext } from './types'

export type ContextStudent = AssistantContext['students'][number]
export type ContextSubject = ContextStudent['subjects'][number]

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous = current
  }
  return previous[b.length]
}

function typoTolerance(length: number): number {
  if (length >= 7) return 2
  if (length >= 4) return 1
  return 0
}

function stripPossessive(word: string): string {
  return word.replace(/'s$|s'$|'$/, '')
}

export type StudentMatch = { student: ContextStudent } | { error: string }

/** Resolves a name as written ("Gabriel", "gabriel's", "Gabrial", "Gabriel Carter") to one student. */
export function matchStudent(ctx: AssistantContext, rawName: string): StudentMatch {
  const name = stripPossessive(normalizeText(rawName).replace(/[^a-z' -]/g, '').trim())
  if (!name) return { error: 'Which student?' }

  const exact = ctx.students.filter((s) => {
    const first = s.firstName.toLowerCase()
    const full = `${first} ${(s.lastName ?? '').toLowerCase()}`.trim()
    return name === first || name === full
  })
  if (exact.length === 1) return { student: exact[0] }
  if (exact.length > 1) {
    return { error: `More than one student is called ${rawName.trim()} — use their full name.` }
  }

  const byLast = ctx.students.filter((s) => s.lastName && s.lastName.toLowerCase() === name)
  if (byLast.length === 1) return { student: byLast[0] }

  const fuzzy = ctx.students
    .map((s) => ({ student: s, distance: levenshtein(name, s.firstName.toLowerCase()) }))
    .filter((m) => m.distance <= typoTolerance(m.student.firstName.length))
    .sort((a, b) => a.distance - b.distance)
  if (fuzzy.length === 1 || (fuzzy.length > 1 && fuzzy[0].distance < fuzzy[1].distance)) {
    return { student: fuzzy[0].student }
  }

  return { error: `There’s no student named “${rawName.trim()}”.` }
}

/** Resolves "math", "Maths", "soc studies", "WB"… against a list of subjects. */
export function matchSubject<T extends { name: string }>(subjects: T[], rawName: string): T | null {
  const name = normalizeSubjectName(rawName)
  if (!name) return null

  for (const subject of subjects) {
    if (subjectAliasesFor(subject.name).includes(name)) return subject
  }
  const prefix = subjects.filter((s) => name.length >= 3 && normalizeSubjectName(s.name).startsWith(name))
  if (prefix.length === 1) return prefix[0]

  const fuzzy = subjects
    .map((s) => ({ subject: s, distance: levenshtein(name, normalizeSubjectName(s.name)) }))
    .filter((m) => m.distance <= typoTolerance(m.subject.name.length))
    .sort((a, b) => a.distance - b.distance)
  return fuzzy[0]?.subject ?? null
}

export interface Mention<T> {
  item: T
  index: number
  length: number
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Every place a student is named in normalized text (first, full or last name, possessives). */
export function findStudentMentions(ctx: AssistantContext, text: string): Mention<ContextStudent>[] {
  const mentions: Mention<ContextStudent>[] = []
  for (const student of ctx.students) {
    const forms = [
      student.lastName ? `${student.firstName} ${student.lastName}` : null,
      student.firstName,
      student.lastName && ctx.students.filter((s) => s.lastName === student.lastName).length === 1 ? student.lastName : null
    ].filter((f): f is string => Boolean(f))
    for (const form of forms) {
      const pattern = new RegExp(`(?<![a-z])${escapeRegExp(form.toLowerCase())}(?:'s|s')?(?![a-z])`, 'g')
      for (const match of text.matchAll(pattern)) {
        mentions.push({ item: student, index: match.index!, length: match[0].length })
      }
    }
  }
  // Prefer the longest form at any position ("Gabriel Carter" over "Gabriel").
  return dedupeMentions(mentions)
}

/** Every place a subject (or an alias of one) is named in normalized text. */
export function findSubjectMentions<T extends { name: string }>(subjects: T[], text: string): Mention<T>[] {
  const mentions: Mention<T>[] = []
  for (const subject of subjects) {
    for (const alias of subjectAliasesFor(subject.name)) {
      if (alias.length < 2) continue
      const pattern = new RegExp(`(?<![a-z])${escapeRegExp(alias)}(?![a-z])`, 'g')
      for (const match of text.matchAll(pattern)) {
        mentions.push({ item: subject, index: match.index!, length: match[0].length })
      }
    }
  }
  return dedupeMentions(mentions)
}

function dedupeMentions<T>(mentions: Mention<T>[]): Mention<T>[] {
  const sorted = [...mentions].sort((a, b) => a.index - b.index || b.length - a.length)
  const result: Mention<T>[] = []
  let end = -1
  for (const mention of sorted) {
    if (mention.index >= end) {
      result.push(mention)
      end = mention.index + mention.length
    }
  }
  return result
}

/** Finds a likely-but-unknown name: a capitalized word right before a progress verb. */
export function guessUnknownName(original: string): string | null {
  const match = /\b([A-Z][a-z]{1,20})(?:'s)?\s+(?:completed|finished|started|began|scored|passed|got|is now|moved)/.exec(original)
  return match ? match[1] : null
}
