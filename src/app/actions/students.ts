'use server'

import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { todayIn } from '@/domain/dates'
import { fieldErrors, newStudentSchema, paceNumberSchema, studentFormSchema } from '@/domain/validation'
import { getDb } from '@/server/db'
import { getHouseholdContext } from '@/server/auth/context'
import { ProgressError } from '@/server/services/progress'
import {
  createStudent,
  deleteStudentWithoutRecords,
  enrollSubject,
  setStudentArchived,
  unenrollSubject,
  updateStudent
} from '@/server/services/students'

type Result<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string; fields?: Record<string, string> }

const SIGNED_OUT = { ok: false as const, error: 'Your session has ended. Sign in again to continue.' }

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ProgressError) return { ok: false, error: error.message }
  console.error(error)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

async function context() {
  const ctx = await getHouseholdContext()
  if (!ctx) return null
  return {
    ctx,
    actor: {
      householdId: ctx.household.id,
      actorUserId: ctx.user.id,
      source: 'manual' as const,
      today: todayIn(ctx.household.timezone)
    }
  }
}

export async function addStudent(input: z.input<typeof newStudentSchema>): Promise<Result<{ studentId: string }>> {
  const c = await context()
  if (!c) return SIGNED_OUT
  const parsed = newStudentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) }
  try {
    const { studentId } = await createStudent(getDb(), c.actor, parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true, data: { studentId } }
  } catch (error) {
    return failure(error)
  }
}

export async function editStudent(studentId: string, input: z.input<typeof studentFormSchema>): Promise<Result> {
  const c = await context()
  if (!c) return SIGNED_OUT
  const parsed = studentFormSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) }
  try {
    await updateStudent(getDb(), c.ctx.household.id, z.uuid().parse(studentId), parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function archiveStudent(studentId: string, archived: boolean): Promise<Result> {
  const c = await context()
  if (!c) return SIGNED_OUT
  try {
    await setStudentArchived(getDb(), c.ctx.household.id, z.uuid().parse(studentId), archived)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function deleteStudent(studentId: string): Promise<Result> {
  const c = await context()
  if (!c) return SIGNED_OUT
  try {
    await deleteStudentWithoutRecords(getDb(), c.ctx.household.id, z.uuid().parse(studentId))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

const enrollSchema = z.object({ studentId: z.uuid(), subjectId: z.uuid(), currentPace: paceNumberSchema.nullable() })

export async function addSubjectToStudent(input: z.input<typeof enrollSchema>): Promise<Result> {
  const c = await context()
  if (!c) return SIGNED_OUT
  const parsed = enrollSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the subject and PACE.' }
  try {
    await enrollSubject(getDb(), c.actor, parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}

export async function removeSubjectFromStudent(studentId: string, subjectId: string): Promise<Result> {
  const c = await context()
  if (!c) return SIGNED_OUT
  try {
    await unenrollSubject(getDb(), c.ctx.household.id, z.uuid().parse(studentId), z.uuid().parse(subjectId))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return failure(error)
  }
}
