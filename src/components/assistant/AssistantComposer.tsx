'use client'

import { useId, useLayoutEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { CornerDownLeft, Sparkles } from 'lucide-react'
import { interpretText } from '@/app/actions/assistant'
import { Button } from '@/components/ui/Button'
import type { AssistantResponse } from '@/server/assistant/types'
import { cx } from '@/lib/cx'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { AssistantResult } from './AssistantResult'
import styles from './Assistant.module.css'

/**
 * Natural-language entry: "Gabriel completed Math 1084 with 94% and started 1085".
 * The text is interpreted into proposed changes; nothing is written until confirmed.
 */
export function AssistantComposer({
  placeholder = 'Tell Folio what happened — “Gabriel completed Math 1084 with 94%”',
  size = 'md',
  autoFocus,
  onSaved,
  onNavigated,
  examples,
  bare
}: {
  placeholder?: string
  size?: 'md' | 'lg'
  autoFocus?: boolean
  onSaved?: () => void
  /** Called when the answer took the parent to another page. */
  onNavigated?: () => void
  examples?: string[]
  /** Inside a dialog: the result sits in the dialog body rather than in its own card. */
  bare?: boolean
}) {
  const [text, setText] = useState('')
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [interpreted, setInterpreted] = useState<string | null>(null)
  const [responseId, setResponseId] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()
  const narrow = useMediaQuery('(max-width: 640px)')

  function run(value: string) {
    const input = value.trim()
    if (!input) return
    setError(null)
    startTransition(async () => {
      const result = await interpretText(input)
      if (result.ok) {
        setResponse(result.data)
        setInterpreted(input)
        setResponseId((id) => id + 1)
      } else {
        setError(result.error)
      }
    })
  }

  // Primary only while there's new text to read; once read, the result's own actions lead.
  const ready = text.trim() !== '' && !(response && text.trim() === interpreted)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    run(text)
  }

  // The field grows with the sentence (up to a few lines), so it can be read back in full before sending.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text, narrow])

  return (
    <div className={styles.composerWrap}>
      <form className={cx(styles.composer, size === 'lg' && styles.composerLg)} onSubmit={onSubmit}>
        <Sparkles className={styles.composerIcon} aria-hidden strokeWidth={1.75} />
        <label className="visually-hidden" htmlFor={inputId}>
          Tell Folio what happened, or ask a question
        </label>
        <textarea
          id={inputId}
          ref={inputRef}
          rows={1}
          className={styles.composerInput}
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\s*\n\s*/g, ' '))}
          onKeyDown={(e) => {
            // Enter sends, as in a single-line field; the text never holds line breaks.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={narrow ? 'Tell Folio what happened…' : placeholder}
          autoComplete="off"
          maxLength={500}
          autoFocus={autoFocus}
          enterKeyHint="go"
        />
        {narrow ? (
          <Button
            type="submit"
            size="md"
            iconOnly
            icon={CornerDownLeft}
            aria-label="Interpret"
            variant={ready ? 'primary' : 'secondary'}
            loading={pending}
            disabled={!text.trim()}
            className={styles.submitMd}
          />
        ) : (
          <Button
            type="submit"
            size={size === 'lg' ? 'md' : 'sm'}
            variant={ready ? 'primary' : 'secondary'}
            loading={pending}
            disabled={!text.trim()}
            trailingIcon={CornerDownLeft}
            className={size === 'lg' ? styles.submitMd : styles.submitSm}
          >
            Interpret
          </Button>
        )}
      </form>
      {examples?.length && !response && !pending ? (
        <div className={styles.examples} aria-label="Examples">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              className={styles.example}
              onClick={() => {
                setText(example)
                run(example)
              }}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className={styles.applyError} role="alert">
          {error}
        </p>
      ) : null}
      {pending && !response ? (
        <div className={styles.thinking} role="status">
          <span className={styles.thinkingDot} aria-hidden />
          Reading that against your records…
        </div>
      ) : null}
      {response ? (
        <AssistantResult
          key={responseId}
          bare={bare}
          response={response}
          onExample={(example) => {
            setText(example)
            run(example)
          }}
          onDone={(outcome) => {
            setResponse(null)
            if (outcome === 'saved') {
              setText('')
              onSaved?.()
            }
            if (outcome === 'navigated') onNavigated?.()
            else inputRef.current?.focus()
          }}
        />
      ) : null}
    </div>
  )
}
