'use client'

import Link from 'next/link'
import { useActionState, useRef } from 'react'
import { signIn, signUp, type AuthFormState } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import styles from '@/app/(auth)/auth.module.css'

export function SignInForm({ next, demo }: { next?: string; demo?: { email: string; password: string } | null }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {})
  const formRef = useRef<HTMLFormElement>(null)

  function openDemo() {
    const form = formRef.current
    if (!form || !demo) return
    ;(form.elements.namedItem('email') as HTMLInputElement).value = demo.email
    ;(form.elements.namedItem('password') as HTMLInputElement).value = demo.password
    form.requestSubmit()
  }

  return (
    <>
      <form ref={formRef} action={action} noValidate className={styles.form}>
        <input type="hidden" name="next" value={next ?? ''} />
        {state.errors?._form ? (
          <div className={styles.formError} role="alert">
            {state.errors._form}
          </div>
        ) : null}
        <Field label="Email" error={state.errors?.email}>
          {(p) => (
            <Input
              {...p}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              inputSize="lg"
              defaultValue={state.values?.email}
              autoFocus
              required
            />
          )}
        </Field>
        <Field label="Password" error={state.errors?.password}>
          {(p) => (
            <Input {...p} name="password" type="password" autoComplete="current-password" inputSize="lg" required />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={pending}>
          Sign in
        </Button>
      </form>
      <p className={styles.switch}>
        New to Folio? <Link href="/sign-up">Create an account</Link>
      </p>
      {demo ? (
        <div className={styles.demo}>
          <div>
            <strong>Demo homeschool</strong>
            Six students with a term of real-looking records.
          </div>
          <Button size="sm" onClick={openDemo} disabled={pending}>
            Open demo
          </Button>
        </div>
      ) : null}
    </>
  )
}

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {})

  return (
    <>
      <form action={action} noValidate className={styles.form}>
        {state.errors?._form ? (
          <div className={styles.formError} role="alert">
            {state.errors._form}
          </div>
        ) : null}
        <Field label="Your name" error={state.errors?.name}>
          {(p) => (
            <Input {...p} name="name" autoComplete="name" inputSize="lg" defaultValue={state.values?.name} autoFocus required />
          )}
        </Field>
        <Field label="Email" error={state.errors?.email}>
          {(p) => (
            <Input
              {...p}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              inputSize="lg"
              defaultValue={state.values?.email}
              required
            />
          )}
        </Field>
        <Field label="Password" hint="At least 8 characters." error={state.errors?.password}>
          {(p) => (
            <Input {...p} name="password" type="password" autoComplete="new-password" inputSize="lg" minLength={8} required />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={pending}>
          Create account
        </Button>
      </form>
      <p className={styles.switch}>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </>
  )
}
