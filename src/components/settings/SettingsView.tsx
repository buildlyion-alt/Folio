'use client'

import { useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash, X } from 'lucide-react'
import {
  addSubject,
  archiveSubjectAction,
  removeTerm,
  renameSubjectAction,
  saveAccount,
  saveHousehold,
  savePassword,
  saveTerm
} from '@/app/actions/settings'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import { formatShortDate } from '@/domain/dates'
import type { HouseholdDTO } from '@/domain/dto'
import { plural } from '@/domain/format'
import styles from './Settings.module.css'

interface Props {
  household: HouseholdDTO
  subjects: Array<{ id: string; name: string; archived: boolean; students: number }>
  terms: Array<{ id: string; name: string; startsOn: string; endsOn: string }>
  user: { name: string; email: string }
  timezones: string[]
  today: string
  assistant: { enabled: boolean; model: string | null }
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionIntro}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          {title}
        </h2>
        <p className={styles.sectionDescription}>{description}</p>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

export function SettingsView(props: Props) {
  return (
    <div className={styles.page}>
      <HouseholdSection household={props.household} timezones={props.timezones} />
      <SubjectsSection subjects={props.subjects} />
      <TermsSection terms={props.terms} today={props.today} />
      <AccountSection user={props.user} />
      <Section id="assistant" title="AI Assistant" description="How natural-language entries are read.">
        <div className={styles.card}>
          <p className={styles.statusLine}>
            <span className={props.assistant.enabled ? styles.dotOn : styles.dotOff} aria-hidden />
            {props.assistant.enabled ? `OpenAI is enabled (${props.assistant.model}).` : 'Using Folio’s offline parser — no AI provider is configured.'}
          </p>
          <p className={styles.help}>
            {props.assistant.enabled
              ? 'Only the sentence you type plus your students’ first names and subject names are sent to OpenAI. Scores and records stay in Folio, and every change still needs your confirmation.'
              : 'To enable AI reading, set OPENAI_API_KEY (and optionally OPENAI_MODEL) on the server. Entries work either way, and every change needs your confirmation.'}
          </p>
        </div>
      </Section>
    </div>
  )
}

function HouseholdSection({ household, timezones }: { household: HouseholdDTO; timezones: string[] }) {
  const toast = useToast()
  const [values, setValues] = useState({
    name: household.name,
    timezone: household.timezone,
    passMark: String(household.passMark),
    pacesPerYear: String(household.pacesPerYear),
    schoolYearStart: household.schoolYearStart
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const set = (key: keyof typeof values) => (value: string) => setValues((v) => ({ ...v, [key]: value }))

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveHousehold({ ...values, schoolYearStart: values.schoolYearStart || null })
      if (result.ok) {
        setErrors({})
        toast({ title: 'Homeschool settings saved', description: 'Dashboards and reports use the new settings.' })
      } else {
        setErrors(result.fields ?? { _form: result.error })
      }
    })
  }

  return (
    <Section id="homeschool" title="Homeschool" description="Used for “today”, on-track status and reports.">
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <div className={styles.grid}>
          <Field label="Homeschool name" error={errors.name}>
            {(p) => <Input {...p} value={values.name} onChange={(e) => set('name')(e.target.value)} maxLength={80} />}
          </Field>
          <Field label="Time zone" error={errors.timezone} hint="Decides what “today” and “this week” mean.">
            {(p) => (
              <Select {...p} value={values.timezone} onChange={(e) => set('timezone')(e.target.value)}>
                {timezones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="School year started" error={errors.schoolYearStart} hint="Year-to-date averages and targets count from here.">
            {(p) => <Input {...p} type="date" value={values.schoolYearStart} onChange={(e) => set('schoolYearStart')(e.target.value)} />}
          </Field>
          <Field label="PACE Test pass mark" error={errors.passMark} hint="A.C.E. uses 80%. Lower scores are flagged.">
            {(p) => <Input {...p} inputMode="numeric" suffix="%" value={values.passMark} onChange={(e) => set('passMark')(e.target.value.replace(/\D/g, '').slice(0, 3))} />}
          </Field>
          <Field label="PACEs per subject per year" error={errors.pacesPerYear} hint="A.C.E. standard is 12 — about one every three weeks.">
            {(p) => <Input {...p} inputMode="numeric" value={values.pacesPerYear} onChange={(e) => set('pacesPerYear')(e.target.value.replace(/\D/g, '').slice(0, 2))} />}
          </Field>
        </div>
        {errors._form ? <p className={styles.error}>{errors._form}</p> : null}
        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Section>
  )
}

function SubjectsSection({ subjects }: { subjects: Props['subjects'] }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function add(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    startTransition(async () => {
      const result = await addSubject(name)
      if (result.ok) {
        toast({ title: `${name.trim()} added`, description: 'Add it to a student from their profile.' })
        setName('')
        setError(null)
      } else setError(result.error)
    })
  }

  function rename() {
    if (!editing) return
    startTransition(async () => {
      const result = await renameSubjectAction(editing.id, editing.name)
      if (result.ok) {
        toast({ title: 'Subject renamed' })
        setEditing(null)
      } else toast({ title: 'Couldn’t rename', description: result.error, tone: 'error' })
    })
  }

  function archive(id: string, archived: boolean, label: string) {
    startTransition(async () => {
      const result = await archiveSubjectAction(id, archived)
      if (result.ok) toast({ title: archived ? `${label} archived` : `${label} restored`, description: archived ? 'Its records stay in every history and report.' : undefined })
      else toast({ title: 'That didn’t work', description: result.error, tone: 'error' })
    })
  }

  return (
    <Section id="subjects" title="Subjects" description="The subjects your students can take. Archiving keeps all records.">
      <div className={styles.card}>
        <ul className={styles.list}>
          {subjects.map((subject) => (
            <li key={subject.id} className={styles.listRow}>
              {editing?.id === subject.id ? (
                <>
                  <Input
                    aria-label={`New name for ${subject.name}`}
                    value={editing.name}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setEditing({ id: subject.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                  <Button size="sm" variant="primary" iconOnly icon={Check} aria-label="Save name" onClick={rename} loading={pending} />
                  <Button size="sm" variant="ghost" iconOnly icon={X} aria-label="Cancel" onClick={() => setEditing(null)} />
                </>
              ) : (
                <>
                  <span className={styles.listName}>
                    {subject.name}
                    {subject.archived ? <Badge>Archived</Badge> : null}
                  </span>
                  <span className={styles.listMeta}>{plural(subject.students, 'student')}</span>
                  <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`Rename ${subject.name}`} onClick={() => setEditing({ id: subject.id, name: subject.name })} />
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={subject.archived ? ArchiveRestore : Archive}
                    aria-label={subject.archived ? `Restore ${subject.name}` : `Archive ${subject.name}`}
                    onClick={() => archive(subject.id, !subject.archived, subject.name)}
                    disabled={pending}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
        <form className={styles.inline} onSubmit={add} noValidate>
          <Field label="Add a subject" error={error} hideLabel>
            {(p) => <Input {...p} placeholder="Add a subject, e.g. Bible Reading" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Button type="submit" icon={Plus} disabled={!name.trim()} loading={pending && Boolean(name)}>
            Add
          </Button>
        </form>
      </div>
    </Section>
  )
}

function TermsSection({ terms, today }: { terms: Props['terms']; today: string }) {
  const toast = useToast()
  const blank = { id: null as string | null, name: '', startsOn: '', endsOn: '' }
  const [draft, setDraft] = useState<typeof blank | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<Props['terms'][number] | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    startTransition(async () => {
      const result = await saveTerm(draft.id, { name: draft.name, startsOn: draft.startsOn, endsOn: draft.endsOn })
      if (result.ok) {
        toast({ title: draft.id ? 'Term updated' : 'Term added', description: 'Use it on the Progress page and in reports.' })
        setDraft(null)
        setErrors({})
      } else setErrors(result.fields ?? { _form: result.error })
    })
  }

  return (
    <Section id="terms" title="Terms" description="Optional. Name your terms to see “this term” on the Progress page.">
      <div className={styles.card}>
        {terms.length ? (
          <ul className={styles.list}>
            {terms.map((term) => (
              <li key={term.id} className={styles.listRow}>
                <span className={styles.listName}>
                  {term.name}
                  {term.startsOn <= today && term.endsOn >= today ? <Badge tone="signal">Current</Badge> : null}
                </span>
                <span className={styles.listMeta}>
                  {formatShortDate(term.startsOn, today)} – {formatShortDate(term.endsOn, today)}
                </span>
                <Button size="sm" variant="ghost" iconOnly icon={Pencil} aria-label={`Edit ${term.name}`} onClick={() => setDraft({ ...term })} />
                <Button size="sm" variant="ghost" iconOnly icon={Trash} aria-label={`Delete ${term.name}`} onClick={() => setConfirmDelete(term)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.help}>No terms yet. Progress and reports use weeks, months and the school year.</p>
        )}
        {draft ? (
          <form className={styles.termForm} onSubmit={submit} noValidate>
            <Field label="Term name" error={errors.name}>
              {(p) => <Input {...p} value={draft.name} placeholder="Fall term" maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />}
            </Field>
            <Field label="Starts" error={errors.startsOn}>
              {(p) => <Input {...p} type="date" value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} />}
            </Field>
            <Field label="Ends" error={errors.endsOn}>
              {(p) => <Input {...p} type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} />}
            </Field>
            <div className={styles.termActions}>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                {draft.id ? 'Save term' : 'Add term'}
              </Button>
            </div>
            {errors._form ? <p className={styles.error}>{errors._form}</p> : null}
          </form>
        ) : (
          <div>
            <Button icon={Plus} onClick={() => setDraft(blank)}>
              Add term
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete ${confirmDelete?.name ?? 'term'}?`}
        description="The term is removed from Progress and report options. No PACE records are affected."
        confirmLabel="Delete term"
        pending={pending}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() =>
          startTransition(async () => {
            if (!confirmDelete) return
            const result = await removeTerm(confirmDelete.id)
            if (result.ok) toast({ title: 'Term deleted' })
            setConfirmDelete(null)
          })
        }
      />
    </Section>
  )
}

function AccountSection({ user }: { user: Props['user'] }) {
  const toast = useToast()
  const [profile, setProfile] = useState(user)
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const [signingOut, startSignOut] = useTransition()

  return (
    <Section id="account" title="Account" description="Your sign-in details.">
      <form
        className={styles.card}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await saveAccount(profile)
            if (result.ok) {
              setProfileErrors({})
              toast({ title: 'Account updated' })
            } else setProfileErrors(result.fields ?? { _form: result.error })
          })
        }}
      >
        <div className={styles.grid}>
          <Field label="Name" error={profileErrors.name}>
            {(p) => <Input {...p} value={profile.name} autoComplete="name" onChange={(e) => setProfile({ ...profile, name: e.target.value })} />}
          </Field>
          <Field label="Email" error={profileErrors.email}>
            {(p) => <Input {...p} type="email" value={profile.email} autoComplete="email" onChange={(e) => setProfile({ ...profile, email: e.target.value })} />}
          </Field>
        </div>
        {profileErrors._form ? <p className={styles.error}>{profileErrors._form}</p> : null}
        <div className={styles.actions}>
          <Button type="submit" loading={pending}>
            Save account
          </Button>
        </div>
      </form>
      <form
        className={styles.card}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await savePassword(passwords)
            if (result.ok) {
              setPasswordErrors({})
              setPasswords({ currentPassword: '', newPassword: '' })
              toast({ title: 'Password changed', description: 'Any other devices were signed out.' })
            } else setPasswordErrors(result.fields ?? { _form: result.error })
          })
        }}
      >
        <div className={styles.grid}>
          <Field label="Current password" error={passwordErrors.currentPassword}>
            {(p) => (
              <Input {...p} type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
            )}
          </Field>
          <Field label="New password" error={passwordErrors.newPassword} hint="At least 8 characters.">
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
            )}
          </Field>
        </div>
        {passwordErrors._form ? <p className={styles.error}>{passwordErrors._form}</p> : null}
        <div className={styles.actions}>
          <Button type="submit" loading={pending} disabled={!passwords.currentPassword || !passwords.newPassword}>
            Change password
          </Button>
          <Button variant="ghost" onClick={() => startSignOut(() => signOut())} loading={signingOut} className={styles.signOut}>
            Sign out
          </Button>
        </div>
      </form>
    </Section>
  )
}
