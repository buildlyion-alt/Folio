'use server'

import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { emailSchema, fieldErrors, householdSettingsSchema, subjectNameSchema, termSchema } from '@/domain/validation'
import { getDb } from '@/server/db'
import { getHouseholdContext } from '@/server/auth/context'
import { ProgressError } from '@/server/services/progress'
import {
  changePassword,
  createSubject,
  createTerm,
  deleteTerm,
  renameSubject,
  setSubjectArchived,
  updateAccount,
  updateHouseholdSettings,
  updateTerm
} from '@/server/services/settings'

type Result = { ok: true } | { ok: false; error: string; fields?: Record<string, string> }

const SIGNED_OUT: Result = { ok: false, error: 'Your session has ended. Sign in again to continue.' }

async function run(work: () => Promise<void>): Promise<Result> {
  try {
    await work()
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    if (error instanceof ProgressError) {
      return { ok: false, error: error.message, fields: error.field ? { [error.field]: error.message } : undefined }
    }
    console.error(error)
    return { ok: false, error: 'Something went wrong saving that. Please try again.' }
  }
}

export async function saveHousehold(input: z.input<typeof householdSettingsSchema>): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = householdSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) }
  return run(() => updateHouseholdSettings(getDb(), ctx.household.id, parsed.data))
}

export async function addSubject(name: string): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = subjectNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fields: { name: parsed.error.issues[0].message } }
  return run(async () => {
    await createSubject(getDb(), ctx.household.id, parsed.data)
  })
}

export async function renameSubjectAction(subjectId: string, name: string): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = subjectNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  return run(() => renameSubject(getDb(), ctx.household.id, z.uuid().parse(subjectId), parsed.data))
}

export async function archiveSubjectAction(subjectId: string, archived: boolean): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  return run(() => setSubjectArchived(getDb(), ctx.household.id, z.uuid().parse(subjectId), archived))
}

export async function saveTerm(termId: string | null, input: z.input<typeof termSchema>): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = termSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the term dates.', fields: fieldErrors(parsed.error) }
  return run(() =>
    termId ? updateTerm(getDb(), ctx.household.id, z.uuid().parse(termId), parsed.data) : createTerm(getDb(), ctx.household.id, parsed.data)
  )
}

export async function removeTerm(termId: string): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  return run(() => deleteTerm(getDb(), ctx.household.id, z.uuid().parse(termId)))
}

const accountSchema = z.object({
  name: z.string().trim().min(1, { error: 'Enter your name.' }).max(80),
  email: emailSchema
})

export async function saveAccount(input: z.input<typeof accountSchema>): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = accountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) }
  return run(() => updateAccount(getDb(), ctx.user.id, parsed.data))
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, { error: 'Enter your current password.' }),
  newPassword: z.string().min(8, { error: 'Use at least 8 characters.' }).max(128)
})

export async function savePassword(input: z.input<typeof passwordSchema>): Promise<Result> {
  const ctx = await getHouseholdContext()
  if (!ctx) return SIGNED_OUT
  const parsed = passwordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the highlighted fields.', fields: fieldErrors(parsed.error) }
  return run(() => changePassword(getDb(), ctx.user.id, parsed.data.currentPassword, parsed.data.newPassword, ctx.session.sessionId))
}
