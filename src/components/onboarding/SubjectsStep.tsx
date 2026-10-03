'use client'

import { useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { DEFAULT_SUBJECTS } from '@/domain/subjects'
import { newKey, type SubjectDraft } from './draft'
import styles from './onboarding.module.css'

const CORE = new Set<string>(DEFAULT_SUBJECTS)

export function SubjectsStep({
  subjects,
  onChange
}: {
  subjects: SubjectDraft[]
  onChange: (subjects: SubjectDraft[]) => void
}) {
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)

  const primary = subjects.filter((s) => !s.suggested)
  const extras = subjects.filter((s) => s.suggested)

  function toggle(key: string, enabled: boolean) {
    onChange(subjects.map((s) => (s.key === key ? { ...s, enabled } : s)))
  }

  function add() {
    const name = custom.trim().replace(/\s+/g, ' ')
    if (!name) return
    const clash = subjects.find((s) => s.name.toLowerCase() === name.toLowerCase())
    if (clash) {
      if (!clash.enabled) toggle(clash.key, true)
      else setError(`“${clash.name}” is already on the list.`)
      setCustom('')
      return
    }
    if (name.length > 40) {
      setError('Keep subject names under 40 characters.')
      return
    }
    onChange([...subjects, { key: newKey('sb'), name, enabled: true, suggested: false }])
    setCustom('')
    setError(null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && custom.trim()) {
      event.preventDefault()
      add()
    }
  }

  const renderToggle = (subject: SubjectDraft) => (
    <label key={subject.key} className={styles.subjectToggle}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={subject.enabled}
        onChange={(e) => toggle(subject.key, e.target.checked)}
      />
      <span className={styles.subjectName}>{subject.name}</span>
      {!subject.suggested && !CORE.has(subject.name) ? (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={X}
          className={styles.removeCustom}
          aria-label={`Remove ${subject.name}`}
          onClick={(e) => {
            e.preventDefault()
            onChange(subjects.filter((s) => s.key !== subject.key))
          }}
        />
      ) : null}
    </label>
  )

  return (
    <div className={styles.subjectGroups}>
      <div>
        <p className={styles.groupLabel}>A.C.E. core subjects</p>
        <div className={styles.subjectGrid}>{primary.map(renderToggle)}</div>
      </div>
      {extras.length ? (
        <div>
          <p className={styles.groupLabel}>Also common</p>
          <div className={styles.subjectGrid}>{extras.map(renderToggle)}</div>
        </div>
      ) : null}
      <Field label="Add another subject" error={error}>
        {(p) => (
          <div className={styles.customRow}>
            <Input
              {...p}
              value={custom}
              placeholder="e.g. Typing, Etymology, Music"
              maxLength={40}
              onChange={(e) => {
                setCustom(e.target.value)
                setError(null)
              }}
              onKeyDown={onKeyDown}
            />
            <Button icon={Plus} onClick={add} disabled={!custom.trim()}>
              Add
            </Button>
          </div>
        )}
      </Field>
    </div>
  )
}
