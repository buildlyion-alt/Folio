import { describe, expect, it } from 'vitest'
import { matchStudent, matchSubject } from '@/server/assistant/matching'
import { extractDate, parseOffline } from '@/server/assistant/offline-parser'
import { makeContext } from './fixtures'

const ctx = makeContext()
const updates = (text: string) => parseOffline(text, ctx).updates

describe('offline parser — progress updates', () => {
  it('reads the canonical example: completion with score, then the next PACE started', () => {
    const command = parseOffline('Gabriel completed Math 1084 today with 94% and started 1085.', ctx)
    expect(command.intent).toBe('log_progress')
    expect(command.updates).toEqual([
      { student: 'Gabriel', subject: 'Mathematics', pace: 1084, status: 'completed', score: 94, date: '2026-10-02', notes: null },
      { student: 'Gabriel', subject: 'Mathematics', pace: 1085, status: 'active', score: null, date: '2026-10-02', notes: null }
    ])
  })

  it('reads flow D: “Gabriel completed Math 1085 with 91%”', () => {
    expect(updates('Gabriel completed Math 1085 with 91%')).toEqual([
      { student: 'Gabriel', subject: 'Mathematics', pace: 1085, status: 'completed', score: 91, date: null, notes: null }
    ])
  })

  it('treats “log … at 94%” as a completion', () => {
    expect(updates('Log Gabriel Math 1084 at 94%')).toMatchObject([{ student: 'Gabriel', subject: 'Mathematics', pace: 1084, status: 'completed', score: 94 }])
  })

  it('attaches a trailing “scored 91” to the update before it', () => {
    expect(updates('Sarah finished English 1078 yesterday, scored 91')).toEqual([
      { student: 'Sarah', subject: 'English', pace: 1078, status: 'completed', score: 91, date: '2026-10-01', notes: null }
    ])
  })

  it('reads “scored N on Subject PACE” word order', () => {
    expect(updates('Joshua scored 87 on Science 1091')).toMatchObject([{ student: 'Joshua', subject: 'Science', pace: 1091, status: 'completed', score: 87 }])
  })

  it('applies one statement to two named students', () => {
    const result = updates('Gabriel and Sarah completed Science 1080')
    expect(result.map((u) => u.student)).toEqual(['Gabriel', 'Sarah'])
    expect(result.every((u) => u.subject === 'Science' && u.pace === 1080 && u.status === 'completed')).toBe(true)
  })

  it('carries the verb and student across a list of subjects', () => {
    expect(updates('Gabriel finished English 1081 (89) and Science 1080 92%')).toMatchObject([
      { student: 'Gabriel', subject: 'English', pace: 1081, status: 'completed', score: 89 },
      { student: 'Gabriel', subject: 'Science', pace: 1080, status: 'completed', score: 92 }
    ])
  })

  it('leaves the PACE empty when it isn’t stated, for the resolver to infer', () => {
    expect(updates('Sarah passed her English PACE with 96%')).toMatchObject([{ student: 'Sarah', subject: 'English', pace: null, status: 'completed', score: 96 }])
  })

  it('reads “percent” and “got”', () => {
    expect(updates('Sarah got 88 percent on Math 1072')).toMatchObject([{ student: 'Sarah', subject: 'Mathematics', pace: 1072, status: 'completed', score: 88 }])
  })

  it('reads a terse entry with no verb', () => {
    expect(updates('Gabriel 1084 94')).toMatchObject([{ student: 'Gabriel', subject: null, pace: 1084, status: 'completed', score: 94 }])
  })

  it('reads “is now on” as starting a PACE', () => {
    expect(updates('Joshua is now on Social Studies 1091')).toMatchObject([{ student: 'Joshua', subject: 'Social Studies', pace: 1091, status: 'active' }])
  })

  it('reads possessives', () => {
    expect(updates("Gabriel's math 1084 is done, 90%")).toMatchObject([{ student: 'Gabriel', subject: 'Mathematics', pace: 1084, status: 'completed', score: 90 }])
  })

  it('keeps an explicit note', () => {
    expect(updates('Gabriel completed Math 1084 with 94%. Note: worked through the Self Test twice')[0].notes).toBe(
      'worked through the Self Test twice'
    )
  })

  it('passes an unknown name through so the resolver can say who it didn’t find', () => {
    expect(updates('Caleb is now on Social Studies 1026')[0].student).toBe('Caleb')
  })

  it('starts “the next one” as a separate update without a PACE number', () => {
    expect(updates('Gabriel completed Math 1084 with 94% and started the next one')).toMatchObject([
      { pace: 1084, status: 'completed', score: 94 },
      { subject: 'Mathematics', pace: null, status: 'active' }
    ])
  })
})

describe('offline parser — dates', () => {
  const date = (text: string) => extractDate(text, ctx).date
  it('resolves relative days against the household’s today (Friday, Oct 2)', () => {
    expect(date('today')).toBe('2026-10-02')
    expect(date('yesterday')).toBe('2026-10-01')
    expect(date('on monday')).toBe('2026-09-28')
    expect(date('last friday')).toBe('2026-09-25')
    expect(date('friday')).toBe('2026-10-02')
  })
  it('resolves month names to the most recent occurrence', () => {
    expect(date('on oct 1')).toBe('2026-10-01')
    expect(date('september 30')).toBe('2026-09-30')
    expect(date('3rd of november')).toBe('2025-11-03')
  })
  it('reads numeric dates month-first in the Americas, day-first elsewhere', () => {
    expect(date('9/30')).toBe('2026-09-30')
    expect(extractDate('1/10', makeContext({ timezone: 'Europe/London' })).date).toBe('2026-10-01')
  })
})

describe('offline parser — questions', () => {
  it('“Who completed PACEs this week?”', () => {
    expect(parseOffline('Who completed PACEs this week?', ctx)).toMatchObject({ intent: 'completed_summary', period: 'this_week' })
  })
  it('“Show scores below 80%”', () => {
    expect(parseOffline('Show scores below 80%', ctx)).toMatchObject({ intent: 'find_records', filters: { scoreMax: 79 } })
  })
  it('“Show me Sarah’s Science progress”', () => {
    expect(parseOffline('Show me Sarah’s Science progress', ctx)).toMatchObject({ intent: 'show_student', student: 'Sarah', subject: 'Science' })
  })
  it('“Generate September’s progress summary”', () => {
    expect(parseOffline('Generate September’s progress summary', ctx)).toMatchObject({ intent: 'report', month: '2026-09', reportType: 'monthly' })
  })
  it('“How is Joshua doing?”', () => {
    expect(parseOffline('How is Joshua doing?', ctx)).toMatchObject({ intent: 'show_student', student: 'Joshua' })
  })
  it('“failing scores” uses the household pass mark', () => {
    expect(parseOffline('find failing scores', ctx)).toMatchObject({ intent: 'find_records', filters: { scoreMax: 79 } })
  })
  it('returns unknown for unrelated text', () => {
    expect(parseOffline('hello there', ctx).intent).toBe('unknown')
  })
})

describe('name matching', () => {
  it('matches first, full and misspelled names', () => {
    expect(matchStudent(ctx, 'gabriel')).toMatchObject({ student: { id: 'gabriel' } })
    expect(matchStudent(ctx, 'Gabriel Carter')).toMatchObject({ student: { id: 'gabriel' } })
    expect(matchStudent(ctx, 'Gabrial')).toMatchObject({ student: { id: 'gabriel' } })
    expect(matchStudent(ctx, 'Sam')).toEqual({ error: 'There’s no student named “Sam”.' })
  })
  it('matches subject aliases', () => {
    const subjects = ctx.subjects
    expect(matchSubject(subjects, 'maths')?.name).toBe('Mathematics')
    expect(matchSubject(subjects, 'soc studies')?.name).toBe('Social Studies')
    expect(matchSubject(subjects, 'WB')?.name).toBe('Word Building')
    expect(matchSubject(subjects, 'lit')?.name).toBe('Literature')
    expect(matchSubject(subjects, 'Sci')?.name).toBe('Science')
    expect(matchSubject(subjects, 'Latin')).toBeNull()
  })
})
