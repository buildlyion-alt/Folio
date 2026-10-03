'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { addStudent } from '@/app/actions/students'
import { useAppData } from '@/components/providers/AppData'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import styles from './Students.module.css'

export function AddStudentDialog({
  open,
  onClose,
  onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: (studentId: string) => void
}) {
  const { subjects } = useAppData()
  const toast = useToast()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [level, setLevel] = useState('')
  const [enrolled, setEnrolled] = useState<Record<string, { on: boolean; pace: string }>>(() =>
    Object.fromEntries(subjects.map((s) => [s.id, { on: true, pace: '' }]))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function reset() {
    setFirstName('')
    setLastName('')
    setLevel('')
    setEnrolled(Object.fromEntries(subjects.map((s) => [s.id, { on: true, pace: '' }])))
    setErrors({})
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!firstName.trim()) {
      setErrors({ firstName: 'Enter a first name.' })
      return
    }
    startTransition(async () => {
      const result = await addStudent({
        firstName,
        lastName: lastName || null,
        level: level ? Number(level) : null,
        enrollments: subjects
          .filter((s) => enrolled[s.id]?.on)
          .map((s) => ({ subjectId: s.id, currentPace: enrolled[s.id].pace ? Number(enrolled[s.id].pace) : null }))
      })
      if (result.ok) {
        toast({ title: `${firstName.trim()} added`, description: 'Their profile is ready for PACE records.' })
        reset()
        onClose()
        onCreated(result.data.studentId)
      } else {
        setErrors(result.fields ?? { _form: result.error })
      }
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add student"
      description="Only a first name is required. Enter current PACEs now or later."
      size="md"
      fullOnMobile
      locked={pending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-student-form" loading={pending}>
            Add student
          </Button>
        </>
      }
    >
      <form id="add-student-form" className={styles.form} onSubmit={onSubmit} noValidate>
        {errors._form ? <p className={styles.formError}>{errors._form}</p> : null}
        <div className={styles.formRow}>
          <Field label="First name" error={errors.firstName}>
            {(p) => <Input {...p} value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={40} data-autofocus autoComplete="off" />}
          </Field>
          <Field label="Last name" optional error={errors.lastName}>
            {(p) => <Input {...p} value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={40} autoComplete="off" />}
          </Field>
          <Field label="Level" optional>
            {(p) => (
              <Select {...p} value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">—</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((l) => (
                  <option key={l} value={l}>
                    Level {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <fieldset className={styles.subjectFieldset}>
          <legend className={styles.legend}>Subjects and current PACE</legend>
          <ul className={styles.subjectRows}>
            {subjects.map((subject) => {
              const state = enrolled[subject.id] ?? { on: false, pace: '' }
              return (
                <li key={subject.id} className={styles.subjectRow}>
                  <label className={styles.subjectCheck}>
                    <input
                      type="checkbox"
                      checked={state.on}
                      onChange={(e) => setEnrolled((m) => ({ ...m, [subject.id]: { ...state, on: e.target.checked } }))}
                    />
                    {subject.name}
                  </label>
                  <Input
                    aria-label={`${subject.name} current PACE`}
                    className="mono"
                    inputMode="numeric"
                    placeholder="PACE"
                    maxLength={4}
                    disabled={!state.on}
                    value={state.pace}
                    onChange={(e) =>
                      setEnrolled((m) => ({ ...m, [subject.id]: { ...state, pace: e.target.value.replace(/\D/g, '').slice(0, 4) } }))
                    }
                  />
                </li>
              )
            })}
          </ul>
        </fieldset>
      </form>
    </Dialog>
  )
}
