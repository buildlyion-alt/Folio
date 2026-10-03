'use server'

import { todayIn } from '@/domain/dates'
import { onboardingSchema, type OnboardingInput } from '@/domain/validation'
import { getDb } from '@/server/db'
import { getSession } from '@/server/auth/context'
import { completeOnboarding } from '@/server/services/onboarding'
import { ProgressError } from '@/server/services/progress'

export type OnboardingResult =
  | { ok: true; students: number; enrollments: number }
  | { ok: false; error: string }

export async function finishOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Your session expired. Sign in again to finish setup.' }

  const parsed = onboardingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' }

  try {
    // No revalidation here: refreshing /onboarding would redirect away before the
    // confirmation step renders. /home is rendered fresh when the parent enters it.
    const result = await completeOnboarding(getDb(), session.user.id, parsed.data, todayIn(parsed.data.timezone))
    return { ok: true, students: result.students, enrollments: result.enrollments }
  } catch (error) {
    if (error instanceof ProgressError) return { ok: false, error: error.message }
    console.error('finishOnboarding failed', error)
    return { ok: false, error: 'Something went wrong saving your homeschool. Please try again.' }
  }
}
