import { requireDatabaseUrl } from './env'
import { eq, sql } from 'drizzle-orm'
import { addDays, startOfWeek, todayIn, type IsoDate } from '../src/domain/dates'
import { DEFAULT_SUBJECTS } from '../src/domain/subjects'
import { createDatabase } from '../src/server/db/client'
import {
  householdMembers,
  households,
  paceRecords,
  progressEvents,
  studentSubjects,
  students,
  subjects,
  users
} from '../src/server/db/schema'
import { hashPassword } from '../src/server/auth/password'
import { DEMO_CREDENTIALS } from '../src/server/demo'

/*
 * Seeds the demo homeschool: six children, the six A.C.E. core subjects, and several
 * months of PACE history ending today. Everything lives in a household flagged
 * is_demo and is wiped and rebuilt on each run — real households are never touched.
 *
 *   npm run db:seed
 *
 * Dates are generated relative to the day you run it, so the demo always looks current.
 */

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--allow-production')) {
  console.error('Refusing to seed demo data in production. Pass --allow-production if you really mean it.')
  process.exit(1)
}

const TIMEZONE = 'America/Chicago'
type Subject = (typeof DEFAULT_SUBJECTS)[number]

interface SubjectPlan {
  /** PACE in progress now, or null when the subject is waiting for its next PACE. */
  current: number | null
  /** Days since the current PACE started (or since the last completion when current is null). */
  currentAge: number
  /** Overrides for specific completed PACEs: score, days ago, note. */
  overrides?: Record<number, { score?: number; daysAgo?: number; note?: string }>
}

interface StudentPlan {
  firstName: string
  level: number
  scoreBase: number
  /** Typical days per PACE for this child. */
  pace: [number, number]
  subjects: Partial<Record<Subject, SubjectPlan>>
}

const PLANS: StudentPlan[] = [
  {
    firstName: 'Gabriel',
    level: 7,
    scoreBase: 91,
    pace: [15, 22],
    subjects: {
      Mathematics: { current: 1084, currentAge: 4, overrides: { 1083: { score: 89, daysAgo: 4 } } },
      English: { current: 1081, currentAge: 9 },
      Science: { current: 1080, currentAge: 12 },
      'Social Studies': { current: 1083, currentAge: 2, overrides: { 1082: { score: 95, daysAgo: 2, note: 'Strong essay on the Oregon Trail.' } } },
      'Word Building': { current: 1082, currentAge: 6 },
      Literature: { current: 1080, currentAge: 14 }
    }
  },
  {
    firstName: 'Sarah',
    level: 6,
    scoreBase: 93,
    pace: [12, 18],
    subjects: {
      Mathematics: { current: 1072, currentAge: 8 },
      English: { current: 1079, currentAge: 0, overrides: { 1078: { score: 91, daysAgo: 0 } } },
      Science: { current: 1069, currentAge: 5 },
      'Social Studies': { current: 1070, currentAge: 11 },
      'Word Building': { current: 1071, currentAge: 1, overrides: { 1070: { score: 98, daysAgo: 1 } } },
      Literature: { current: 1068, currentAge: 16 }
    }
  },
  {
    firstName: 'Joshua',
    level: 8,
    scoreBase: 86,
    pace: [16, 24],
    subjects: {
      Mathematics: { current: 1094, currentAge: 10 },
      English: { current: 1093, currentAge: 6 },
      Science: { current: 1092, currentAge: 0, overrides: { 1091: { score: 87, daysAgo: 1 } } },
      'Social Studies': {
        current: 1090,
        currentAge: 9,
        overrides: { 1089: { score: 76, daysAgo: 10, note: 'Below pass mark — retest planned after reviewing chapters 3–4.' } }
      },
      'Word Building': { current: 1092, currentAge: 13 },
      Literature: { current: 1089, currentAge: 7 }
    }
  },
  {
    firstName: 'Hannah',
    level: 4,
    scoreBase: 92,
    pace: [14, 20],
    subjects: {
      Mathematics: { current: 1040, currentAge: 3, overrides: { 1039: { score: 84, daysAgo: 3, note: 'Struggled with long division — reviewed the Self Test together first.' } } },
      English: { current: 1039, currentAge: 8 },
      Science: { current: 1038, currentAge: 10 },
      'Word Building': { current: 1041, currentAge: 5 },
      Literature: { current: null, currentAge: 3, overrides: { 1036: { score: 96, daysAgo: 3 } } }
    }
  },
  {
    firstName: 'Caleb',
    level: 3,
    scoreBase: 90,
    pace: [16, 23],
    subjects: {
      Mathematics: { current: 1028, currentAge: 6 },
      English: { current: 1027, currentAge: 4, overrides: { 1026: { score: 88, daysAgo: 4 } } },
      Science: { current: 1026, currentAge: 15 },
      'Social Studies': { current: 1025, currentAge: 38 },
      'Word Building': { current: 1029, currentAge: 9 }
    }
  },
  {
    firstName: 'Abigail',
    level: 1,
    scoreBase: 96,
    pace: [12, 16],
    subjects: {
      Mathematics: { current: 1006, currentAge: 2, overrides: { 1005: { score: 100, daysAgo: 2 } } },
      English: { current: 1005, currentAge: 7 },
      'Word Building': { current: 1004, currentAge: 5 }
    }
  }
]

// Small deterministic PRNG so every seed produces the same family.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(20261002)
const between = (min: number, max: number) => Math.round(min + random() * (max - min))

/** A timestamp on a calendar date at a given local hour (approximate Central time), never in the future. */
function at(date: IsoDate, hourUtc: number, now: Date): Date {
  const stamp = new Date(`${date}T${String(hourUtc).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}:00Z`)
  return stamp > now ? new Date(now.getTime() - between(5, 90) * 60_000) : stamp
}

async function main(): Promise<void> {
  const { db, pool } = createDatabase(requireDatabaseUrl())
  const now = new Date()
  const today = todayIn(TIMEZONE, now)
  // The school year began on a Monday about nine weeks ago.
  const schoolYearStart = startOfWeek(addDays(today, -62))
  const historyStart = addDays(today, -150)

  await db.transaction(async (tx) => {
    // Wipe the previous demo — and only the demo.
    await tx.delete(households).where(eq(households.isDemo, true))
    await tx.delete(users).where(sql`lower(${users.email}) = ${DEMO_CREDENTIALS.email}`)

    const [user] = await tx
      .insert(users)
      .values({ name: 'Rachel Carter', email: DEMO_CREDENTIALS.email, passwordHash: await hashPassword(DEMO_CREDENTIALS.password) })
      .returning({ id: users.id })

    const [household] = await tx
      .insert(households)
      .values({
        name: 'Carter Homeschool',
        timezone: TIMEZONE,
        schoolYearStart,
        isDemo: true,
        onboardedAt: new Date(`${historyStart}T15:00:00Z`)
      })
      .returning({ id: households.id })
    await tx.insert(householdMembers).values({ householdId: household.id, userId: user.id, role: 'owner' })

    const subjectRows = await tx
      .insert(subjects)
      .values(DEFAULT_SUBJECTS.map((name, i) => ({ householdId: household.id, name, sortOrder: i })))
      .returning({ id: subjects.id, name: subjects.name })
    const subjectId = new Map(subjectRows.map((s) => [s.name, s.id]))

    let recordCount = 0
    for (const [index, plan] of PLANS.entries()) {
      const [student] = await tx
        .insert(students)
        .values({ householdId: household.id, firstName: plan.firstName, lastName: 'Carter', level: plan.level, sortOrder: index })
        .returning({ id: students.id })

      for (const [subjectName, subjectPlan] of Object.entries(plan.subjects) as Array<[Subject, SubjectPlan]>) {
        const [enrollment] = await tx
          .insert(studentSubjects)
          .values({ householdId: household.id, studentId: student.id, subjectId: subjectId.get(subjectName)! })
          .returning({ id: studentSubjects.id })

        const records: Array<typeof paceRecords.$inferInsert> = []
        // The PACE in progress (if any) started `currentAge` days ago.
        const anchor = addDays(today, -subjectPlan.currentAge)
        let nextStart = anchor
        let paceNumber: number
        if (subjectPlan.current !== null) {
          records.push({
            householdId: household.id,
            studentSubjectId: enrollment.id,
            paceNumber: subjectPlan.current,
            status: 'active',
            startedOn: anchor
          })
          paceNumber = subjectPlan.current - 1
        } else {
          // Waiting for the next PACE: the last one finished `currentAge` days ago.
          nextStart = addDays(anchor, 1)
          paceNumber = Math.max(...Object.keys(subjectPlan.overrides ?? {}).map(Number))
        }

        // Walk backwards through completed PACEs until the history window is covered.
        while (paceNumber > 1000) {
          const override = subjectPlan.overrides?.[paceNumber]
          const completedOn = override?.daysAgo !== undefined ? addDays(today, -override.daysAgo) : addDays(nextStart, -between(0, 1))
          const startedOn = addDays(completedOn, -between(plan.pace[0], plan.pace[1]))
          if (startedOn < historyStart) break
          const score = override?.score ?? Math.min(100, Math.max(80, plan.scoreBase + between(-7, 6)))
          records.push({
            householdId: household.id,
            studentSubjectId: enrollment.id,
            paceNumber,
            status: 'completed',
            startedOn,
            completedOn,
            testScore: score,
            notes: override?.note ?? null
          })
          nextStart = startedOn
          paceNumber -= 1
        }

        if (records.length === 0) continue
        const inserted = await tx
          .insert(paceRecords)
          .values(records.map((r) => ({ ...r, createdAt: at(r.startedOn!, 14, now), updatedAt: at(r.completedOn ?? r.startedOn!, 20, now) })))
          .returning()
        recordCount += inserted.length

        const events: Array<typeof progressEvents.$inferInsert> = []
        for (const record of inserted) {
          events.push({
            householdId: household.id,
            studentSubjectId: enrollment.id,
            paceRecordId: record.id,
            paceNumber: record.paceNumber,
            kind: 'started',
            status: 'active',
            occurredOn: record.startedOn!,
            source: 'demo',
            actorUserId: user.id,
            createdAt: at(record.startedOn!, 14, now)
          })
          if (record.status === 'completed') {
            events.push({
              householdId: household.id,
              studentSubjectId: enrollment.id,
              paceRecordId: record.id,
              paceNumber: record.paceNumber,
              kind: 'completed',
              status: 'completed',
              testScore: record.testScore,
              occurredOn: record.completedOn!,
              source: 'demo',
              actorUserId: user.id,
              createdAt: at(record.completedOn!, 20, now)
            })
          }
        }
        await tx.insert(progressEvents).values(events)
      }
    }

    console.log(`Demo homeschool seeded: ${PLANS.length} students, ${recordCount} PACE records (today is ${today} in ${TIMEZONE}).`)
  })

  await pool.end()
  console.log(`Sign in with ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
