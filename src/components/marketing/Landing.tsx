import Link from 'next/link'
import { ArrowDown, ArrowRight, ClipboardCheck, FileText, History, LayoutGrid, Split, Timer, type LucideIcon } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import { cx } from '@/lib/cx'
import { atkinson, bricolage } from './fonts'
import { MobileMenu, type MenuLink } from './MobileMenu'
import { AssistantPreview, HistoryPreview, HomePreview, LogPreview, PhonePreview, SavedPreview } from './Previews'
import styles from './Landing.module.css'

/*
 * Folio's public landing page. Every claim here maps to something the app does today:
 * see README.md "Features" and PRODUCT.md "Capabilities and Constraints" before adding one.
 */

const SECTIONS: MenuLink[] = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#records', label: 'Recordkeeping' },
  { href: '#faq', label: 'FAQ' }
]

export function Landing({ signedIn }: { signedIn: boolean }) {
  const primary = signedIn ? { href: '/home', label: 'Open dashboard' } : { href: '/sign-up', label: 'Start tracking' }

  return (
    <div className={cx(styles.page, bricolage.variable, atkinson.variable)}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <SiteHeader primary={primary} signedIn={signedIn} />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Hero primary={primary} />
        <Questions />
        <Workflow />
        <HowItWorks primary={primary} />
        <Benefits />
        <Proof />
        <Trust />
        <Assistant />
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <SiteFooter signedIn={signedIn} />
    </div>
  )
}

/* Header ------------------------------------------------------------------------------------- */

function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <LogoMark size={26} />
      <span className={styles.wordmarkText}>Folio</span>
    </span>
  )
}

function SiteHeader({ primary, signedIn }: { primary: MenuLink; signedIn: boolean }) {
  const account = signedIn ? { href: '/home', label: 'Open dashboard' } : { href: '/sign-in', label: 'Sign in' }
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brandLink} aria-label="Folio, home">
          <Wordmark />
        </Link>
        <nav aria-label="Sections" className={styles.nav}>
          <ul>
            {SECTIONS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={styles.navLink}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.headerActions}>
          {signedIn ? null : (
            <Link href="/sign-in" className={styles.signIn}>
              Sign in
            </Link>
          )}
          <Link href={primary.href} className={cx(styles.button, styles.buttonPrimary, styles.headerCta)}>
            {primary.label}
          </Link>
          <MobileMenu links={SECTIONS} account={account} />
        </div>
      </div>
    </header>
  )
}

/* 1. Hero ------------------------------------------------------------------------------------ */

function Hero({ primary }: { primary: MenuLink }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={cx(styles.container, styles.heroText)}>
        <h1 id="hero-title" className={styles.heroTitle}>
          A calmer way to track every <span className={styles.heroMark}>PACE</span>.
        </h1>
        <div className={styles.heroAside}>
          <p className={styles.heroLede}>
            Folio is a simple record book for families using the A.C.E. curriculum. See each child’s current PACE in every
            subject, record PACE Test scores in a few seconds, and keep a permanent history of every completed PACE, without
            paper forms or spreadsheets.
          </p>
          <div className={styles.ctaRow}>
            <Link href={primary.href} className={cx(styles.button, styles.buttonPrimary, styles.buttonLarge)}>
              {primary.label}
              <ArrowRight aria-hidden strokeWidth={2} />
            </Link>
            <a href="#how-it-works" className={cx(styles.button, styles.buttonQuiet, styles.buttonLarge)}>
              See how it works
              <ArrowDown aria-hidden strokeWidth={2} />
            </a>
          </div>
          <p className={styles.heroNote}>For homeschool parents and supervisors · Works on your computer and your phone</p>
        </div>
      </div>

      <figure className={styles.heroStage}>
        <div className={cx(styles.container, styles.heroComposition)}>
          <div className={styles.heroWindow}>
            <HomePreview highlight={{ child: 'Grace', subject: 'Mathematics' }} />
          </div>
          <div className={styles.heroDialog}>
            <SavedPreview />
          </div>
        </div>
        <figcaption className="visually-hidden">
          Folio’s Home screen for a family with four children, Daniel, Grace, Sarah and Caleb, showing each child’s current
          PACE in Mathematics, English, Science, Social Studies and Word Building. Grace’s Mathematics PACE 1048 has just been
          saved as completed with a score of 92%, and Folio is offering to start PACE 1049.
        </figcaption>
      </figure>
    </section>
  )
}

/* 2. Problem to outcome ----------------------------------------------------------------------- */

const QUESTIONS = [
  {
    question: 'Which PACE is Grace on in Science?',
    answer: 'Every child’s current PACE in every subject, together on one screen.'
  },
  {
    question: 'What did Daniel score on his last Mathematics PACE Test?',
    answer: 'Each score is saved with its PACE and date, in Daniel’s Mathematics history.'
  },
  {
    question: 'Which PACEs did the children finish this month?',
    answer: 'A monthly report, built from the records you’ve already kept and ready to print.'
  },
  {
    question: 'Can I put something in our files or share it with our co-op?',
    answer: 'Printable reports and CSV downloads, whenever you need them.'
  }
]

function Questions() {
  return (
    <section className={styles.section} aria-labelledby="questions-title">
      <div className={cx(styles.container, styles.split)}>
        <div className={styles.splitHead}>
          <h2 id="questions-title" className={styles.h2}>
            You already keep careful records. Folio keeps them in one place.
          </h2>
          <p className={styles.lede}>
            Most A.C.E. families track progress across score sheets, notebooks, the PACEs themselves and a spreadsheet or two.
            It works, until a simple question means checking three places.
          </p>
        </div>
        <div className={styles.ledger}>
          <div className={styles.ledgerHead} aria-hidden>
            <span>The question</span>
            <span>Where Folio answers it</span>
          </div>
          <dl>
            {QUESTIONS.map((item) => (
              <div key={item.question} className={styles.ledgerRow}>
                <dt className={styles.ledgerQuestion}>{item.question}</dt>
                <dd className={styles.ledgerAnswer}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

/* 3. Built around the A.C.E. workflow --------------------------------------------------------- */

const LOOP = [
  { step: 'Child', text: 'Each child has a record of their own.', example: 'Grace' },
  { step: 'Subject', text: 'Choose their subjects. Siblings can take different ones.', example: 'Mathematics' },
  { step: 'PACE', text: 'Set the PACE they’re working in now.', example: 'PACE 1048' },
  { step: 'Progress', text: 'Mark it started, then completed.', example: 'Started 15 Sep' },
  { step: 'PACE Test', text: 'Record the score. Below your pass mark is flagged.', example: '92%' },
  { step: 'Next PACE', text: 'Folio suggests the next number. You start it.', example: 'Start 1049' },
  { step: 'Permanent record', text: 'The finished PACE stays in the history.', example: 'Completed 3 Oct' }
]

function Workflow() {
  return (
    <section className={cx(styles.section, styles.sectionTight)} aria-labelledby="workflow-title">
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 id="workflow-title" className={styles.h2}>
            Built around the way A.C.E. works.
          </h2>
          <p className={styles.lede}>
            Folio follows the same path your children take through each subject, and uses the words you already use: PACE,
            PACE Test, pass mark and Level.
          </p>
        </div>
        <ol className={styles.loop}>
          {LOOP.map((item, index) => (
            <li key={item.step} className={styles.loopStep}>
              <span className={styles.loopIndex} aria-hidden>
                {index + 1}
              </span>
              <h3 className={styles.loopTitle}>{item.step}</h3>
              <p className={styles.loopText}>{item.text}</p>
              <p className={styles.loopExample}>
                <span className="visually-hidden">For example: </span>
                {item.example}
              </p>
            </li>
          ))}
        </ol>
        <p className={styles.loopNote}>
          Enter a PACE number from 1001 to 1144 and Folio shows its Level. Electives and other numbering are accepted too.
        </p>
      </div>
    </section>
  )
}

/* 4. How it works ---------------------------------------------------------------------------- */

const STEPS = [
  {
    title: 'Add your children and their subjects',
    text: 'A short setup asks for your homeschool’s name, your children, their subjects and the PACE each child is on now. The six core A.C.E. subjects are already selected, and you can add your own.'
  },
  {
    title: 'Record progress and PACE Test results',
    text: 'When a PACE is finished, select it on Home, type the score and save. Folio then offers to start the next PACE, ready for you to confirm.'
  },
  {
    title: 'Review history and produce reports',
    text: 'Open any child to see their results by subject, search every record, and print a weekly, monthly or full academic summary when you need one.'
  }
]

function HowItWorks({ primary }: { primary: MenuLink }) {
  return (
    <section id="how-it-works" className={cx(styles.section, styles.sectionMuted)} aria-labelledby="how-title">
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 id="how-title" className={styles.h2}>
            Set up in one sitting. Keep up in seconds.
          </h2>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.stepItem}>
              <span className={styles.stepNumber} aria-hidden>
                {index + 1}
              </span>
              <h3 className={styles.h3}>{step.title}</h3>
              <p className={styles.body}>{step.text}</p>
            </li>
          ))}
        </ol>
        <div className={styles.inlineCta}>
          <Link href={primary.href} className={cx(styles.button, styles.buttonPrimary, styles.buttonLarge)}>
            {primary.label}
            <ArrowRight aria-hidden strokeWidth={2} />
          </Link>
          <p className={styles.inlineCtaNote}>Add every child at once. You can change anything later.</p>
        </div>
      </div>
    </section>
  )
}

/* 5. Benefits -------------------------------------------------------------------------------- */

const BENEFITS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: LayoutGrid,
    title: 'See every child at a glance',
    text: 'One table shows each child’s current PACE in every subject, and how many PACEs they’ve finished this week.'
  },
  {
    icon: Timer,
    title: 'Record progress in moments',
    text: 'Select a PACE on Home and the form opens with the child, subject and PACE already filled in. Type the score and save.'
  },
  {
    icon: Split,
    title: 'Siblings and subjects stay separate',
    text: 'Each child has their own subjects and PACE numbers, so one child’s work never ends up in another’s record.'
  },
  {
    icon: ClipboardCheck,
    title: 'Scores and finished PACEs are kept',
    text: 'Every completed PACE keeps its dates and test score, and any later edit is noted in that record’s history.'
  },
  {
    icon: History,
    title: 'You decide when to advance',
    text: 'After a PACE is completed, Folio suggests the next one. Nothing starts until you choose it.'
  },
  {
    icon: FileText,
    title: 'Clear reports when you need them',
    text: 'Weekly, monthly, student, subject, test score, completed PACE and academic summary reports, ready to print or save as a PDF, with a CSV download.'
  }
]

function Benefits() {
  return (
    <section id="features" className={styles.section} aria-labelledby="features-title">
      <div className={cx(styles.container, styles.split)}>
        <div className={cx(styles.splitHead, styles.sticky)}>
          <h2 id="features-title" className={styles.h2}>
            Less time on records. More confidence in them.
          </h2>
          <p className={styles.lede}>
            Folio does a few things and does them carefully, so it’s easy to open every day, whether you teach one child or
            six.
          </p>
        </div>
        <ul className={styles.benefits}>
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className={styles.benefit}>
              <span className={styles.benefitIcon} aria-hidden>
                <Icon strokeWidth={1.75} />
              </span>
              <div>
                <h3 className={styles.h3}>{title}</h3>
                <p className={styles.body}>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* 6. Product proof --------------------------------------------------------------------------- */

const NOTES = [
  'Start from a PACE on Home and the child, subject and PACE are already chosen.',
  'The Level is worked out from the PACE number, so a mistyped number stands out.',
  'On a phone, each child gets their own block, and Log is always in the middle of the tab bar.'
]

function Proof() {
  return (
    <section className={cx(styles.section, styles.sectionMuted)} aria-labelledby="proof-title">
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <h2 id="proof-title" className={styles.h2}>
            The same few steps on a laptop or a phone.
          </h2>
          <p className={styles.lede}>
            At the table after school or on your phone right after a PACE Test, recording progress works the same way: choose
            the PACE, enter the score, save.
          </p>
        </div>

        <figure className={styles.proof}>
          <div className={styles.proofStage}>
            <div className={styles.proofDesk}>
              <LogPreview />
              <span className={cx(styles.marker, styles.markerOne)} aria-hidden>
                1
              </span>
              <span className={cx(styles.marker, styles.markerTwo)} aria-hidden>
                2
              </span>
            </div>
            <div className={styles.proofPhone}>
              <PhonePreview />
              <span className={cx(styles.marker, styles.markerThree)} aria-hidden>
                3
              </span>
            </div>
          </div>
          <figcaption className={styles.proofNotes}>
            <span className="visually-hidden">
              Left: the Log progress form for Grace, Mathematics PACE 1048, Level 4, completed with a score of 92%. Right: Folio’s
              Home screen on a phone.
            </span>
            <ol>
              {NOTES.map((note, index) => (
                <li key={note}>
                  <span className={styles.noteNumber} aria-hidden>
                    {index + 1}
                  </span>
                  {note}
                </li>
              ))}
            </ol>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/* 7. Trust and record safety ----------------------------------------------------------------- */

const SAFEGUARDS = [
  {
    title: 'Nothing is overwritten quietly',
    text: 'Each PACE has one record. If saving would change a PACE that’s already completed, Folio tells you before you save.'
  },
  {
    title: 'Every change is remembered',
    text: 'Starts, completions and edits are listed in each record’s history, with the date and how they were entered.'
  },
  {
    title: 'You decide when to move on',
    text: 'Folio suggests the next PACE after a completion. It only starts when you choose it.'
  },
  {
    title: 'Deleting asks first',
    text: 'Removing a record needs your confirmation, and the history keeps a note that it was removed.'
  },
  {
    title: 'Your records stay with your household',
    text: 'Each family’s records are kept separate and shown only to that household’s account.'
  }
]

function Trust() {
  return (
    <section id="records" className={styles.section} aria-labelledby="records-title">
      <div className={cx(styles.container, styles.split)}>
        <div className={styles.splitHead}>
          <h2 id="records-title" className={styles.h2}>
            A record you can rely on, years from now.
          </h2>
          <p className={styles.lede}>
            Your children’s academic history matters. Folio treats it carefully and keeps you in charge of every change.
          </p>
          <figure className={styles.historyFigure}>
            <HistoryPreview />
            <figcaption className="visually-hidden">
              A PACE record in Folio: Grace, Mathematics PACE 1048, started 15 September and completed 3 October with 92%, with
              both events listed in its history.
            </figcaption>
          </figure>
        </div>
        <ul className={styles.safeguards}>
          {SAFEGUARDS.map((item) => (
            <li key={item.title} className={styles.safeguard}>
              <h3 className={styles.h3}>{item.title}</h3>
              <p className={styles.body}>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* 8. Optional AI assistance ------------------------------------------------------------------ */

function Assistant() {
  return (
    <section className={cx(styles.section, styles.sectionMuted)} aria-labelledby="assistant-title">
      <div className={cx(styles.container, styles.assistantGrid)}>
        <div className={styles.assistantText}>
          <h2 id="assistant-title" className={styles.h2}>
            Prefer to type it? Say what happened.
          </h2>
          <p className={styles.lede}>
            Write a sentence the way you’d say it. Folio matches the child, subject and PACE, then shows you exactly what it
            will save. You confirm, edit or cancel.
          </p>
          <ul className={styles.assistantPoints}>
            <li>
              <strong>Nothing is saved until you confirm.</strong> The assistant only prepares the entry.
            </li>
            <li>
              <strong>Anything unusual is pointed out,</strong> such as a score below your pass mark or a name Folio doesn’t
              recognize.
            </li>
            <li>
              <strong>It’s optional.</strong> Everything in Folio works with the ordinary form, too.
            </li>
          </ul>
        </div>
        <figure className={styles.assistantFigure}>
          <AssistantPreview />
          <figcaption className="visually-hidden">
            A typed entry, “Log that Daniel completed Math PACE 1052 with a score of 92%,” and Folio’s review of it: Daniel,
            Mathematics, PACE 1052, completed with 92% today, with buttons to confirm, edit or cancel. Nothing is saved until
            you confirm.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/* 9. FAQ ------------------------------------------------------------------------------------- */

const FAQS = [
  {
    question: 'Is Folio designed specifically for A.C.E.?',
    answer:
      'Yes. Folio is built around PACEs, PACE Tests, pass marks and Levels, and starts you with the six core A.C.E. subjects: Mathematics, English, Science, Social Studies, Word Building and Literature. You can add your own subjects as well.'
  },
  {
    question: 'Can I manage more than one child?',
    answer:
      'Yes. Add as many children as you teach. During setup you can paste a list of names to add them all at once, and Home shows everyone together.'
  },
  {
    question: 'Can each child be on different PACEs?',
    answer:
      'Yes. Every child has their own current PACE in each subject, so Grace can be working in Mathematics 1048 while Daniel is in 1052.'
  },
  {
    question: 'Does Folio replace the curriculum materials?',
    answer:
      'No. Your children keep working in their PACEs, Checkups and Self Tests as usual. Folio is where you record which PACE each child is in, when it was started and completed, and the PACE Test score. It doesn’t track individual pages, Checkups or Self Tests.'
  },
  {
    question: 'Can I print or export my records?',
    answer:
      'Yes. Reports are laid out for printing or saving as a PDF, and each one can be downloaded as a CSV file. You can also export your full list of records as a CSV.'
  },
  {
    question: 'Does the AI save records automatically?',
    answer:
      'No. When you type an entry, Folio shows what it understood and what would change. Nothing is saved until you confirm, and you can edit or cancel it first. You never have to use it.'
  },
  {
    question: 'What if I make a mistake?',
    answer:
      'You can edit or delete any record. Folio asks before deleting, and each record’s history lists every change and when it was made.'
  },
  {
    question: 'Can I use Folio on my phone?',
    answer:
      'Yes. Folio runs in your phone’s web browser with a layout made for small screens, so you can check where everyone is or record a score on the spot. There’s nothing to install.'
  }
]

function Faq() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={cx(styles.container, styles.split)}>
        <div className={styles.splitHead}>
          <h2 id="faq-title" className={styles.h2}>
            Questions parents ask
          </h2>
          <p className={styles.lede}>Straight answers about what Folio does, and what it doesn’t.</p>
        </div>
        <div className={styles.faqList}>
          {FAQS.map((item) => (
            <details key={item.question} className={styles.faq}>
              <summary className={styles.faqQuestion}>
                <h3 className={styles.faqTitle}>{item.question}</h3>
                <span className={styles.faqIcon} aria-hidden />
              </summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* 10. Final call to action -------------------------------------------------------------------- */

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className={styles.final} aria-labelledby="final-title">
      <div className={cx(styles.container, styles.finalInner)}>
        <h2 id="final-title" className={styles.finalTitle}>
          Spend less time reconstructing records and more time supporting your children.
        </h2>
        <div className={styles.finalAside}>
          <p className={styles.finalLede}>
            Set up your homeschool in one sitting, add every child at once, and keep each PACE Test score where you can find it.
          </p>
          <div className={styles.ctaRow}>
            {signedIn ? (
              <Link href="/home" className={cx(styles.button, styles.buttonAccent, styles.buttonLarge)}>
                Open your dashboard
                <ArrowRight aria-hidden strokeWidth={2} />
              </Link>
            ) : (
              <>
                <Link href="/sign-up" className={cx(styles.button, styles.buttonAccent, styles.buttonLarge)}>
                  Start tracking with Folio
                  <ArrowRight aria-hidden strokeWidth={2} />
                </Link>
                <Link href="/sign-in" className={styles.finalSignIn}>
                  Already have an account? Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* Footer ------------------------------------------------------------------------------------- */

function SiteFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className={styles.footer}>
      <div className={cx(styles.container, styles.footerInner)}>
        <div className={styles.footerBrand}>
          <Wordmark />
          <p>Recordkeeping for homeschool families using the A.C.E. curriculum.</p>
        </div>
        <nav aria-label="Footer" className={styles.footerNav}>
          <ul>
            {SECTIONS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
          <ul>
            {signedIn ? (
              <li>
                <Link href="/home">Open dashboard</Link>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/sign-in">Sign in</Link>
                </li>
                <li>
                  <Link href="/sign-up">Create an account</Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
      <div className={cx(styles.container, styles.footerBase)}>
        <p>© {new Date().getFullYear()} Folio</p>
      </div>
    </footer>
  )
}
