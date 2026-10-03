'use client'

import { useRef, type KeyboardEvent } from 'react'
import { Avatar } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { initials, plural } from '@/domain/format'
import { cx } from '@/lib/cx'
import { cellKey, cellState, type StudentDraft, type SubjectDraft } from './draft'
import styles from './onboarding.module.css'

interface PaceGridStepProps {
  students: StudentDraft[]
  subjects: SubjectDraft[]
  positions: Record<string, string>
  onChange: (positions: Record<string, string>) => void
  filled: number
  invalid: number
}

/**
 * Bulk entry for every child's current PACE in every subject — one screen instead of
 * one screen per child. Behaves like a spreadsheet: Tab moves across, Enter moves down,
 * arrow keys move in any direction.
 */
export function PaceGridStep({ students, subjects, positions, onChange, filled, invalid }: PaceGridStepProps) {
  const cells = useRef(new Map<string, HTMLInputElement>())

  function setCell(key: string, raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    onChange({ ...positions, [key]: digits })
  }

  function focusCell(row: number, col: number) {
    const student = students[row]
    const subject = subjects[col]
    if (!student || !subject) return false
    const input = cells.current.get(`grid:${cellKey(student.key, subject.key)}`)
    if (!input) return false
    input.focus()
    input.select()
    return true
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const input = event.currentTarget
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0
    const atEnd = input.selectionStart === input.value.length
    let moved = false
    if (event.key === 'Enter') {
      moved = focusCell(row + 1, col) || focusCell(0, col + 1)
      event.preventDefault()
    } else if (event.key === 'ArrowDown') {
      moved = focusCell(row + 1, col)
    } else if (event.key === 'ArrowUp') {
      moved = focusCell(row - 1, col)
    } else if (event.key === 'ArrowRight' && atEnd) {
      moved = focusCell(row, col + 1)
    } else if (event.key === 'ArrowLeft' && atStart) {
      moved = focusCell(row, col - 1)
    }
    if (moved) event.preventDefault()
  }

  // Copies the first PACE in a row into the row's empty cells — handy for younger
  // children who are at the same point in every subject.
  function fillRow(student: StudentDraft) {
    const first = subjects.map((s) => positions[cellKey(student.key, s.key)]).find((v) => cellState(v) === 'valid')
    if (!first) return
    const next = { ...positions }
    for (const subject of subjects) {
      const key = cellKey(student.key, subject.key)
      if (!next[key]) next[key] = first
    }
    onChange(next)
  }

  const canFill = (student: StudentDraft) => {
    const values = subjects.map((s) => positions[cellKey(student.key, s.key)])
    return values.some((v) => cellState(v) === 'valid') && values.some((v) => !v)
  }

  const cellInput = (student: StudentDraft, subject: SubjectDraft, row: number, col: number, variant: 'grid' | 'stacked') => {
    const key = cellKey(student.key, subject.key)
    const value = positions[key] ?? ''
    const state = cellState(value)
    return (
      <input
        ref={(el) => {
          if (el) cells.current.set(`${variant}:${key}`, el)
          else cells.current.delete(`${variant}:${key}`)
        }}
        className={cx(styles.cell, state === 'valid' && styles.cellValid, state === 'invalid' && styles.cellInvalid)}
        aria-label={`${student.firstName} — ${subject.name} current PACE`}
        aria-invalid={state === 'invalid' || undefined}
        inputMode="numeric"
        autoComplete="off"
        placeholder="—"
        value={value}
        maxLength={4}
        autoFocus={variant === 'grid' && row === 0 && col === 0}
        onChange={(e) => setCell(key, e.target.value)}
        onKeyDown={variant === 'grid' ? (e) => onKeyDown(e, row, col) : undefined}
        onFocus={(e) => e.currentTarget.select()}
      />
    )
  }

  return (
    <>
      <div className={styles.gridPanel}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th scope="col">Student</th>
              {subjects.map((subject) => (
                <th scope="col" key={subject.key}>
                  {subject.name}
                </th>
              ))}
              <th scope="col">
                <span className="visually-hidden">Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, row) => (
              <tr key={student.key}>
                <th scope="row" className={styles.rowHeader}>
                  <span className={styles.rowName}>
                    <Avatar initials={initials(student.firstName, student.lastName)} seed={student.key} size="sm" />
                    {student.firstName}
                  </span>
                </th>
                {subjects.map((subject, col) => (
                  <td key={subject.key}>{cellInput(student, subject, row, col, 'grid')}</td>
                ))}
                <td className={styles.fillCell}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => fillRow(student)}
                    disabled={!canFill(student)}
                    title="Copy the first PACE into this row’s empty cells"
                  >
                    Fill row
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.stacked}>
        {students.map((student, row) => (
          <section key={student.key} className={styles.stackedStudent} aria-label={student.firstName}>
            <div className={styles.stackedHead}>
              <span className={styles.rowName}>
                <Avatar initials={initials(student.firstName, student.lastName)} seed={student.key} size="sm" />
                {student.firstName}
              </span>
              <Button size="sm" variant="ghost" onClick={() => fillRow(student)} disabled={!canFill(student)}>
                Fill row
              </Button>
            </div>
            <div className={styles.stackedCells}>
              {subjects.map((subject, col) => (
                <label key={subject.key} className={styles.stackedCell}>
                  {subject.name}
                  {cellInput(student, subject, row, col, 'stacked')}
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className={styles.gridMeta} aria-live="polite">
        <span>
          <strong>{filled}</strong> current {filled === 1 ? 'PACE' : 'PACEs'} · {plural(students.length, 'student')} ×{' '}
          {plural(subjects.length, 'subject')}
        </span>
        {invalid > 0 ? (
          <span className={styles.gridError}>
            {invalid === 1 ? 'One cell needs' : `${invalid} cells need`} a PACE number between 1 and 9999.
          </span>
        ) : (
          <span>You can change any of these later.</span>
        )}
      </div>
    </>
  )
}
