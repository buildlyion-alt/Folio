/** The six A.C.E. core subjects offered by default during onboarding. */
export const DEFAULT_SUBJECTS = [
  'Mathematics',
  'English',
  'Science',
  'Social Studies',
  'Word Building',
  'Literature'
] as const

/** Common additions parents can toggle on with one click. */
export const SUGGESTED_EXTRA_SUBJECTS = ['Bible Reading', 'Creative Writing', 'Spanish'] as const

/**
 * Everyday names parents use for subjects, mapped to the canonical subject they mean.
 * Used by both the offline parser and the assistant's name resolver.
 */
const ALIASES: Record<string, string> = {
  math: 'mathematics',
  maths: 'mathematics',
  mathematics: 'mathematics',
  arithmetic: 'mathematics',
  eng: 'english',
  english: 'english',
  grammar: 'english',
  sci: 'science',
  science: 'science',
  'social studies': 'social studies',
  'soc studies': 'social studies',
  'soc stud': 'social studies',
  social: 'social studies',
  socials: 'social studies',
  ss: 'social studies',
  history: 'social studies',
  'word building': 'word building',
  wordbuilding: 'word building',
  'word-building': 'word building',
  wb: 'word building',
  spelling: 'word building',
  vocab: 'word building',
  lit: 'literature',
  literature: 'literature',
  'lit and creative writing': 'literature',
  bible: 'bible reading',
  'bible reading': 'bible reading',
  'creative writing': 'creative writing',
  writing: 'creative writing',
  spanish: 'spanish'
}

export function normalizeSubjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** All the phrases that should be recognized as this subject. */
export function subjectAliasesFor(subjectName: string): string[] {
  const normalized = normalizeSubjectName(subjectName)
  const aliases = new Set<string>([normalized])
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (canonical === normalized) aliases.add(alias)
  }
  return [...aliases].sort((a, b) => b.length - a.length)
}

/** Compact label for dense columns: "Mathematics" → "Math". */
export function subjectShortName(subjectName: string): string {
  const known: Record<string, string> = {
    mathematics: 'Math',
    english: 'English',
    science: 'Science',
    'social studies': 'Soc. Studies',
    'word building': 'Word Bldg.',
    literature: 'Literature',
    'bible reading': 'Bible',
    'creative writing': 'Writing'
  }
  return known[normalizeSubjectName(subjectName)] ?? subjectName
}
