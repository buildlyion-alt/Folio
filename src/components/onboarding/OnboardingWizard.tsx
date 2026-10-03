'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { finishOnboarding } from '@/app/actions/onboarding'
import { signOut } from '@/app/actions/auth'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Misc'
import { plural } from '@/domain/format'
import { cx } from '@/lib/cx'
import {
  cellKey,
  cellState,
  clearDraft,
  enabledSubjects,
  loadDraft,
  namedStudents,
  saveDraft,
  type OnboardingDraft
} from './draft'
import { StudentsStep } from './StudentsStep'
import { SubjectsStep } from './SubjectsStep'
import { PaceGridStep } from './PaceGridStep'
import styles from './onboarding.module.css'

const STEPS = ['Homeschool', 'Students', 'Subjects', 'Current PACEs'] as const

interface WizardProps {
  userId: string
  userName: string
}

// The draft lives in localStorage, so render client-only to avoid a hydration mismatch.
export const OnboardingWizard = dynamic(() => Promise.resolve(Wizard), {
  ssr: false,
  loading: () => (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.content}>
          <Skeleton width={180} height={14} />
          <Skeleton width="70%" height={28} />
          <Skeleton width="100%" height={40} />
        </div>
      </div>
    </div>
  )
})

function Wizard({ userId, userName }: WizardProps) {
  const router = useRouter()
  const [draft, setDraft] = useState<OnboardingDraft>(() => loadDraft(userId, userName))
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ students: number; enrollments: number } | null>(null)
  const [saving, startSaving] = useTransition()
  const [entering, startEntering] = useTransition()

  useEffect(() => {
    if (result) return
    const timer = window.setTimeout(() => saveDraft(userId, draft), 250)
    return () => window.clearTimeout(timer)
  }, [draft, userId, result])

  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const step = result ? 4 : draft.step
  const students = namedStudents(draft)
  const subjects = enabledSubjects(draft)

  const grid = useMemo(() => {
    let filled = 0
    let invalid = 0
    for (const student of students) {
      for (const subject of subjects) {
        const state = cellState(draft.positions[cellKey(student.key, subject.key)])
        if (state === 'valid') filled += 1
        if (state === 'invalid') invalid += 1
      }
    }
    return { filled, invalid }
  }, [draft.positions, students, subjects])

  const canContinue = [
    draft.householdName.trim().length > 0,
    students.length > 0,
    subjects.length > 0,
    grid.invalid === 0
  ][step]

  function goTo(next: number) {
    setError(null)
    update({ step: next })
    window.scrollTo({ top: 0 })
  }

  function submit() {
    setError(null)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const positions = students.flatMap((student) =>
      subjects.flatMap((subject) => {
        const raw = draft.positions[cellKey(student.key, subject.key)]
        return cellState(raw) === 'valid'
          ? [{ studentKey: student.key, subjectKey: subject.key, paceNumber: Number(raw!.trim()) }]
          : []
      })
    )
    startSaving(async () => {
      const response = await finishOnboarding({
        householdName: draft.householdName,
        timezone,
        students: students.map((s) => ({
          key: s.key,
          firstName: s.firstName,
          lastName: s.lastName || null,
          level: s.level ? Number(s.level) : null
        })),
        subjects: subjects.map((s) => ({ key: s.key, name: s.name })),
        positions
      })
      if (response.ok) {
        clearDraft(userId)
        setResult({ students: response.students, enrollments: response.enrollments })
        window.scrollTo({ top: 0 })
      } else {
        setError(response.error)
      }
    })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canContinue || saving) return
    if (step === 3) submit()
    else goTo(step + 1)
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Logo />
        {step < 4 ? (
          <div className={styles.progress} aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
            <div className={styles.segments} aria-hidden>
              {STEPS.map((label, i) => (
                <span
                  key={label}
                  className={cx(styles.segment, i < step && styles.segmentDone, i === step && styles.segmentCurrent)}
                />
              ))}
            </div>
            <span>
              {step + 1} of {STEPS.length}
            </span>
          </div>
        ) : null}
        <form action={signOut}>
          <button type="submit" className={styles.signOut}>
            Sign out
          </button>
        </form>
      </header>

      <main className={styles.main}>
        {step === 4 && result ? (
          <Done
            householdName={draft.householdName}
            students={result.students}
            enrollments={result.enrollments}
            entering={entering}
            onEnter={() => startEntering(() => router.push('/home'))}
          />
        ) : (
          <form className={cx(styles.content, step === 3 && styles.wide)} onSubmit={onSubmit} key={step} noValidate>
            {step === 0 ? (
              <>
                <StepHeading
                  step={0}
                  title="Let’s set up your homeschool."
                  lede="Folio keeps every child’s PACE progress, test scores and records in one place. Setup takes about two minutes."
                />
                <Field label="Homeschool name" hint="Shown on reports and at the top of your dashboard.">
                  {(p) => (
                    <Input
                      {...p}
                      inputSize="lg"
                      value={draft.householdName}
                      onChange={(e) => update({ householdName: e.target.value })}
                      placeholder="e.g. Carter Homeschool"
                      maxLength={80}
                      autoFocus
                    />
                  )}
                </Field>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <StepHeading
                  step={1}
                  title="Who’s learning at home?"
                  lede="Add each child. A first name is all Folio needs — you can paste several names at once."
                />
                <StudentsStep students={draft.students} onChange={(list) => update({ students: list })} />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <StepHeading
                  step={2}
                  title="Which subjects are they taking?"
                  lede="The A.C.E. core subjects are selected. Turn off any you don’t use, or add your own."
                />
                <SubjectsStep subjects={draft.subjects} onChange={(list) => update({ subjects: list })} />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <StepHeading
                  step={3}
                  title="Where is everyone right now?"
                  lede="Type the PACE number each child is working on. Leave a cell empty if they don’t take that subject. Tab moves across, Enter moves down."
                />
                <PaceGridStep
                  students={students}
                  subjects={subjects}
                  positions={draft.positions}
                  onChange={(positions) => update({ positions })}
                  filled={grid.filled}
                  invalid={grid.invalid}
                />
              </>
            ) : null}

            {error ? (
              <div className={styles.error} role="alert">
                {error}
              </div>
            ) : null}

            <div className={styles.footer}>
              {step > 0 ? (
                <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={saving}>
                  Back
                </Button>
              ) : (
                <span className={styles.footerNote}>Nothing is saved until you finish.</span>
              )}
              <div className={styles.footerActions}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={!canContinue}
                  loading={saving}
                  trailingIcon={step === 3 ? undefined : ArrowRight}
                >
                  {step === 3 ? 'Finish setup' : 'Continue'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </main>
      <span />
    </div>
  )
}

function StepHeading({ step, title, lede }: { step: number; title: string; lede: string }) {
  return (
    <div className={styles.heading}>
      <span className={styles.stepLabel}>{STEPS[step]}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lede}>{lede}</p>
    </div>
  )
}

function Done({
  householdName,
  students,
  enrollments,
  entering,
  onEnter
}: {
  householdName: string
  students: number
  enrollments: number
  entering: boolean
  onEnter: () => void
}) {
  return (
    <div className={styles.content}>
      <div className={styles.heading}>
        <span className={styles.doneMark} aria-hidden>
          <Check strokeWidth={2.25} />
        </span>
        <h1 className={styles.title}>{householdName} is ready.</h1>
        <p className={styles.lede}>
          From here, log completed PACEs and test scores as they happen — from the form, or by simply telling
          Folio what happened.
        </p>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{students}</span>
          <span className={styles.statLabel}>{plural(students, 'student').replace(/^\d+ /, '')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{enrollments}</span>
          <span className={styles.statLabel}>active subjects</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{enrollments}</span>
          <span className={styles.statLabel}>current PACEs</span>
        </div>
      </div>
      <div>
        <Button variant="primary" size="lg" onClick={onEnter} loading={entering} trailingIcon={ArrowRight} autoFocus>
          Enter dashboard
        </Button>
      </div>
    </div>
  )
}
