import type { AssistantContext } from '@/server/assistant/types'

const subject = (id: string, name: string, current: number | null, last: number | null = current ? current - 1 : null) => ({
  subjectId: id,
  subjectName: name,
  current: current ? { recordId: `rec-${id}-${current}`, paceNumber: current } : null,
  lastCompleted: last ? { paceNumber: last, completedOn: '2026-09-28', testScore: 90 } : null
})

/** A household like the demo: Gabriel, Sarah, Joshua — on Friday, October 2, 2026. */
export function makeContext(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    today: '2026-10-02',
    timezone: 'America/Chicago',
    passMark: 80,
    subjects: [
      { id: 'math', name: 'Mathematics' },
      { id: 'eng', name: 'English' },
      { id: 'sci', name: 'Science' },
      { id: 'ss', name: 'Social Studies' },
      { id: 'wb', name: 'Word Building' },
      { id: 'lit', name: 'Literature' }
    ],
    students: [
      {
        id: 'gabriel',
        firstName: 'Gabriel',
        lastName: 'Carter',
        subjects: [
          subject('math', 'Mathematics', 1084),
          subject('eng', 'English', 1081),
          subject('sci', 'Science', 1080),
          subject('ss', 'Social Studies', 1083),
          subject('wb', 'Word Building', 1082),
          subject('lit', 'Literature', 1080)
        ]
      },
      {
        id: 'sarah',
        firstName: 'Sarah',
        lastName: 'Carter',
        subjects: [subject('math', 'Mathematics', 1072), subject('eng', 'English', 1078), subject('sci', 'Science', 1069)]
      },
      {
        id: 'joshua',
        firstName: 'Joshua',
        lastName: 'Carter',
        subjects: [subject('sci', 'Science', 1091), subject('ss', 'Social Studies', 1090)]
      }
    ],
    ...overrides
  }
}
