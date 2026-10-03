'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Misc'
import { initials } from '@/domain/format'
import { emptyStudent, type StudentDraft } from './draft'
import styles from './onboarding.module.css'

const LEVELS = Array.from({ length: 12 }, (_, i) => i + 1)

export function StudentsStep({
  students,
  onChange
}: {
  students: StudentDraft[]
  onChange: (students: StudentDraft[]) => void
}) {
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const pendingFocus = useRef<string | null>(null)

  function patch(key: string, values: Partial<StudentDraft>) {
    onChange(students.map((s) => (s.key === key ? { ...s, ...values } : s)))
  }

  function addAfter(index: number, seed: Partial<StudentDraft> = {}) {
    const student = { ...emptyStudent(), ...seed }
    pendingFocus.current = student.key
    const next = [...students]
    next.splice(index + 1, 0, student)
    onChange(next)
  }

  function remove(key: string) {
    if (students.length === 1) {
      onChange([emptyStudent()])
      return
    }
    onChange(students.filter((s) => s.key !== key))
  }

  // "Gabriel, Sarah, Joshua" or one name per line → one row each.
  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = event.clipboardData.getData('text')
    if (!/[,\n\t;]/.test(text)) return
    event.preventDefault()
    const people = text
      .split(/[\n,\t;]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((name) => {
        const [first, ...rest] = name.split(/\s+/)
        return { firstName: first, lastName: rest.join(' ') }
      })
    if (people.length === 0) return
    const current = students[index]
    const rows = people.map((person, i) =>
      i === 0 ? { ...current, ...person, lastName: person.lastName || current.lastName } : { ...emptyStudent(), ...person }
    )
    const next = [...students]
    next.splice(index, 1, ...rows)
    pendingFocus.current = null
    onChange(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    const student = students[index]
    if (!student.firstName.trim()) return // Enter on an empty row submits the step
    event.preventDefault()
    const following = students[index + 1]
    if (following) inputs.current.get(following.key)?.focus()
    else addAfter(index)
  }

  return (
    <div className={styles.studentList}>
      <div className={styles.studentHead} aria-hidden>
        <span>First name</span>
        <span>Last name</span>
        <span>Level</span>
      </div>
      {students.map((student, index) => {
        const label = student.firstName.trim() || `Student ${index + 1}`
        return (
          <div className={styles.studentRow} key={student.key}>
            <Avatar initials={student.firstName ? initials(student.firstName, student.lastName) : '·'} seed={student.key} />
            <Input
              ref={(el) => {
                if (el) {
                  inputs.current.set(student.key, el)
                  if (pendingFocus.current === student.key) {
                    pendingFocus.current = null
                    el.focus()
                  }
                } else {
                  inputs.current.delete(student.key)
                }
              }}
              aria-label={`Student ${index + 1} first name`}
              placeholder="First name"
              value={student.firstName}
              maxLength={40}
              autoComplete="off"
              autoFocus={index === 0 && !student.firstName}
              onChange={(e) => patch(student.key, { firstName: e.target.value })}
              onPaste={(e) => onPaste(e, index)}
              onKeyDown={(e) => onKeyDown(e, index)}
            />
            <Input
              aria-label={`${label} last name (optional)`}
              placeholder="Last name (optional)"
              value={student.lastName}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => patch(student.key, { lastName: e.target.value })}
              onKeyDown={(e) => onKeyDown(e, index)}
            />
            <Select
              aria-label={`${label} level (optional)`}
              value={student.level}
              onChange={(e) => patch(student.key, { level: e.target.value })}
            >
              <option value="">Level —</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  Level {level}
                </option>
              ))}
            </Select>
            <Button
              variant="ghost"
              iconOnly
              icon={X}
              aria-label={`Remove ${label}`}
              onClick={() => remove(student.key)}
            />
          </div>
        )
      })}
      <Button variant="ghost" icon={Plus} className={styles.addRow} onClick={() => addAfter(students.length - 1)}>
        Add student
      </Button>
      <p className={styles.hint}>Press Enter after a name to add the next child.</p>
    </div>
  )
}
