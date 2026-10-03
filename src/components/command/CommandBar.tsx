'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { ArrowLeft, BookOpen, CornerDownLeft, FileText, Plus, Search, Sparkles, UserPlus, type LucideIcon } from 'lucide-react'
import { interpretText, search } from '@/app/actions/assistant'
import { AssistantResult } from '@/components/assistant/AssistantResult'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { useAppData } from '@/components/providers/AppData'
import { NAV_GROUPS } from '@/components/shell/nav'
import { Avatar, Kbd } from '@/components/ui/Misc'
import { formatShortDate } from '@/domain/dates'
import { PACE_STATUS_LABEL } from '@/domain/pace'
import type { AssistantResponse } from '@/server/assistant/types'
import type { SearchResults } from '@/server/queries/search'
import { cx } from '@/lib/cx'
import styles from './CommandBar.module.css'

interface Item {
  id: string
  section: string
  label: string
  detail?: string
  icon?: LucideIcon
  avatar?: { initials: string; seed: string }
  run: () => void
  signal?: boolean
}

/** Text that reads like a sentence or question goes to the assistant; a single word is a search. */
function looksLikeRequest(query: string): boolean {
  const words = query.trim().split(/\s+/)
  return words.length >= 3 || /\?$/.test(query.trim()) || (words.length >= 2 && /\d/.test(query) && /[a-z]/i.test(query))
}

export function CommandBar({ open, initialQuery, onClose }: { open: boolean; initialQuery: string; onClose: () => void }) {
  const router = useRouter()
  const openLog = useLogProgress()
  const { roster } = useAppData()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [query, setQuery] = useState(initialQuery)
  const [active, setActive] = useState(0)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [responseId, setResponseId] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [interpreting, startInterpreting] = useTransition()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      inputRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Server-side search for PACE numbers and subjects, debounced.
  useEffect(() => {
    const q = query.trim()
    if (!open || !q || response) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const found = await search(q)
      if (!cancelled) setResults(found)
    }, 140)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, open, response])

  function go(href: string) {
    onClose()
    router.push(href)
  }

  function ask(text: string) {
    setError(null)
    startInterpreting(async () => {
      const result = await interpretText(text)
      if (result.ok) {
        setResponse(result.data)
        setResponseId((id) => id + 1)
      } else {
        setError(result.error)
      }
    })
  }

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const list: Item[] = []
    const pages = NAV_GROUPS.flatMap((g) => g.items)

    if (!q) {
      list.push(
        { id: 'log', section: 'Actions', label: 'Log progress', icon: Plus, signal: true, run: () => { onClose(); openLog() } },
        { id: 'ask', section: 'Actions', label: 'Open the assistant', detail: 'Or just type an update here', icon: Sparkles, run: () => go('/assistant') },
        { id: 'add-student', section: 'Actions', label: 'Add a student', icon: UserPlus, run: () => go('/students?new=1') }
      )
      for (const student of roster) {
        list.push({
          id: `student-${student.id}`,
          section: 'Students',
          label: student.displayName,
          detail: student.subjects.map((s) => (s.current ? `${s.subjectName.slice(0, 4)} ${s.current.paceNumber}` : null)).filter(Boolean).slice(0, 4).join(' · '),
          avatar: { initials: student.initials, seed: student.id },
          run: () => go(`/students/${student.id}`)
        })
      }
      for (const page of pages) list.push({ id: `page-${page.href}`, section: 'Go to', label: page.label, icon: page.icon, run: () => go(page.href) })
      return list
    }

    if (looksLikeRequest(query)) {
      list.push({
        id: 'interpret',
        section: 'Assistant',
        label: `Ask Folio: “${query.trim()}”`,
        detail: 'Interpret as a progress update or question',
        icon: Sparkles,
        signal: true,
        run: () => ask(query)
      })
    }
    for (const student of roster) {
      if (student.displayName.toLowerCase().includes(q) || q.split(/\s+/).some((w) => w.length > 1 && student.firstName.toLowerCase().startsWith(w))) {
        list.push({
          id: `student-${student.id}`,
          section: 'Students',
          label: student.displayName,
          avatar: { initials: student.initials, seed: student.id },
          run: () => go(`/students/${student.id}`)
        })
      }
    }
    for (const record of results?.records ?? []) {
      list.push({
        id: `record-${record.id}`,
        section: 'Records',
        label: `${record.studentName} · ${record.subjectName} ${record.paceNumber}`,
        detail:
          record.status === 'completed'
            ? `Completed ${record.completedOn ? formatShortDate(record.completedOn) : ''}${record.testScore !== null ? ` · ${record.testScore}%` : ''}`
            : PACE_STATUS_LABEL[record.status],
        icon: FileText,
        run: () => go(`/students/${record.studentId}?record=${record.id}`)
      })
    }
    for (const subject of results?.subjects ?? []) {
      list.push({ id: `subject-${subject.id}`, section: 'Subjects', label: `${subject.name} records`, icon: BookOpen, run: () => go(`/records?subject=${subject.id}`) })
    }
    for (const page of pages) {
      if (page.label.toLowerCase().includes(q)) list.push({ id: `page-${page.href}`, section: 'Go to', label: page.label, icon: page.icon, run: () => go(page.href) })
    }
    if (!list.some((i) => i.id === 'interpret')) {
      list.push({ id: 'interpret', section: 'Assistant', label: `Ask Folio: “${query.trim()}”`, icon: Sparkles, run: () => ask(query) })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, roster, results])

  const clampedActive = Math.min(active, Math.max(items.length - 1, 0))

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (response) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setResponse(null)
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % Math.max(items.length, 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i - 1 + items.length) % Math.max(items.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      items[clampedActive]?.run()
    }
  }

  let lastSection = ''

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Search and commands"
      onCancel={(event) => {
        event.preventDefault()
        if (response) setResponse(null)
        else onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open ? (
        <div className={styles.panel}>
          <div className={styles.inputRow}>
            {response ? (
              <button type="button" className={styles.back} onClick={() => setResponse(null)} aria-label="Back to search">
                <ArrowLeft aria-hidden strokeWidth={1.75} />
              </button>
            ) : (
              <Search className={styles.inputIcon} aria-hidden strokeWidth={1.75} />
            )}
            <input
              ref={inputRef}
              className={styles.input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
                setResponse(null)
                if (!e.target.value.trim()) setResults(null)
              }}
              onKeyDown={onKeyDown}
              placeholder="Search students and PACEs, or tell Folio what happened…"
              role="combobox"
              aria-expanded={!response}
              aria-controls={listId}
              aria-activedescendant={!response && items[clampedActive] ? `${listId}-${items[clampedActive].id}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
            />
            {interpreting ? <span className={styles.spinner} aria-label="Interpreting" /> : <Kbd>esc</Kbd>}
          </div>

          <div className={styles.body}>
            {error ? <p className={styles.error}>{error}</p> : null}
            {response ? (
              <div className={styles.resultWrap}>
                <AssistantResult
                  key={responseId}
                  response={response}
                  onExample={(example) => {
                    setQuery(example)
                    ask(example)
                  }}
                  onDone={(outcome) => {
                    if (outcome === 'cancelled') {
                      setResponse(null)
                      inputRef.current?.focus()
                    } else {
                      onClose()
                    }
                  }}
                />
              </div>
            ) : (
              <ul id={listId} role="listbox" aria-label="Results" className={styles.list}>
                {items.map((item, index) => {
                  const header = item.section !== lastSection ? item.section : null
                  lastSection = item.section
                  return (
                    <li key={item.id} role="presentation">
                      {header ? (
                        <p className={styles.section} role="presentation">
                          {header}
                        </p>
                      ) : null}
                      <div
                        id={`${listId}-${item.id}`}
                        role="option"
                        aria-selected={index === clampedActive}
                        className={cx(styles.item, index === clampedActive && styles.itemActive)}
                        onMouseMove={() => setActive(index)}
                        onClick={() => item.run()}
                      >
                        {item.avatar ? (
                          <Avatar initials={item.avatar.initials} seed={item.avatar.seed} size="sm" />
                        ) : item.icon ? (
                          <span className={cx(styles.itemIcon, item.signal && styles.itemIconSignal)}>
                            <item.icon aria-hidden strokeWidth={1.75} />
                          </span>
                        ) : null}
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.detail ? <span className={styles.itemDetail}>{item.detail}</span> : null}
                        {index === clampedActive ? <CornerDownLeft className={styles.enter} aria-hidden strokeWidth={1.75} /> : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className={styles.footer}>
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
            </span>
            <span>
              <Kbd>↵</Kbd> to open
            </span>
            <span className={styles.footerHint}>Try “Gabriel completed Math 1084 with 94%”</span>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
