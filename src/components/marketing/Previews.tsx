import { Check, Files, House, Pencil, Play, Plus, ScrollText, Search, Sparkles, Users } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import { cx } from '@/lib/cx'
import styles from './Previews.module.css'

/*
 * Product previews for the landing page.
 *
 * These are static recreations of real Folio screens (Home, Log progress, the assistant's
 * review, a record's history, Home on a phone), built from the app's own tokens and layout
 * rules so they stay faithful to what a parent will see after signing up. They are
 * illustrations: nothing inside them is focusable, and each one is described in words by
 * the figure that contains it.
 */

type Tone = 0 | 1 | 2 | 3

interface Child {
  name: string
  tone: Tone
  week: number
  paces: Record<Subject, number | null>
  flag?: Subject
}

const SUBJECTS = ['Mathematics', 'English', 'Science', 'Social Studies', 'Word Building'] as const
type Subject = (typeof SUBJECTS)[number]

const CHILDREN: Child[] = [
  {
    name: 'Daniel',
    tone: 0,
    week: 2,
    paces: { Mathematics: 1052, English: 1050, Science: 1051, 'Social Studies': 1049, 'Word Building': 1053 }
  },
  {
    name: 'Grace',
    tone: 1,
    week: 2,
    paces: { Mathematics: 1048, English: 1046, Science: 1045, 'Social Studies': 1047, 'Word Building': 1046 }
  },
  {
    name: 'Sarah',
    tone: 2,
    week: 1,
    paces: { Mathematics: 1079, English: 1081, Science: 1078, 'Social Studies': 1080, 'Word Building': 1082 },
    flag: 'Social Studies'
  },
  {
    name: 'Caleb',
    tone: 3,
    week: 1,
    paces: { Mathematics: 1020, English: 1018, Science: 1017, 'Social Studies': null, 'Word Building': 1019 }
  }
]

function Avatar({ name, tone, size = 'sm' }: { name: string; tone: Tone; size?: 'xs' | 'sm' }) {
  return <span className={cx(styles.avatar, styles[`tone${tone}`], styles[size])}>{name[0]}</span>
}

function Flag() {
  return <span className={styles.flag} />
}

/* Home on a computer: the rail, the greeting, and every child's current PACE. --------------- */

export function HomePreview({ highlight }: { highlight?: { child: string; subject: Subject } }) {
  return (
    <div className={cx(styles.app, styles.window)} aria-hidden>
      <div className={styles.chrome}>
        <span className={styles.lights}>
          <span />
          <span />
          <span />
        </span>
        <span className={styles.chromeTitle}>Home · Folio</span>
      </div>
      <div className={styles.appBody}>
        <div className={styles.rail}>
          <div className={styles.railBrand}>
            <LogoMark size={22} />
            <span className={styles.railBrandText}>
              <span className={styles.railWord}>Folio</span>
              <span className={styles.railHousehold}>Bennett Homeschool</span>
            </span>
          </div>
          <span className={cx(styles.btn, styles.btnPrimary, styles.btnBlock)}>
            <Plus strokeWidth={2} />
            Log progress
          </span>
          <span className={styles.railSearch}>
            <Search strokeWidth={1.75} />
            Search
          </span>
          <span className={cx(styles.railItem, styles.railItemActive)}>
            <House strokeWidth={1.75} />
            Home
          </span>
          <span className={styles.railItem}>
            <Users strokeWidth={1.75} />
            Students
          </span>
          <span className={styles.railItem}>
            <Files strokeWidth={1.75} />
            Records
          </span>
          <span className={styles.railItem}>
            <ScrollText strokeWidth={1.75} />
            Reports
          </span>
        </div>

        <div className={styles.content}>
          <div className={styles.homeHead}>
            <p className={styles.greeting}>Good afternoon, Ruth.</p>
            <p className={styles.summary}>
              <span>
                <strong>4</strong> students
              </span>
              <span>
                <strong>6</strong> PACEs completed this week
              </span>
              <span className={styles.summaryWide}>
                <strong>91%</strong> average score
              </span>
            </p>
          </div>

          <div className={styles.composer}>
            <Sparkles strokeWidth={1.75} />
            <span>Tell Folio what happened — “Grace finished Math 1048 with 92%”</span>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>What everyone is working on</p>
            <p className={styles.sectionHint}>
              Current PACE in each subject. Select one to log progress.
              <span className={styles.legend}>
                <Flag /> needs a look
              </span>
            </p>
          </div>

          <div className={styles.surface}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={styles.nameCol}>Student</th>
                  {SUBJECTS.map((subject) => (
                    <th key={subject}>{subject}</th>
                  ))}
                  <th className={styles.weekCol}>This week</th>
                </tr>
              </thead>
              <tbody>
                {CHILDREN.map((child) => (
                  <tr key={child.name}>
                    <th className={styles.nameCol}>
                      <span className={styles.student}>
                        <Avatar name={child.name} tone={child.tone} />
                        {child.name}
                      </span>
                    </th>
                    {SUBJECTS.map((subject) => {
                      const pace = child.paces[subject]
                      const active = highlight?.child === child.name && highlight.subject === subject
                      return (
                        <td key={subject}>
                          {pace ? (
                            <span className={cx(styles.pace, active && styles.paceActive)}>
                              <span className={styles.mono}>{pace}</span>
                              {child.flag === subject ? <Flag /> : null}
                            </span>
                          ) : null}
                        </td>
                      )
                    })}
                    <td className={styles.weekCol}>{child.week}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* The dialog that follows a save: the record, then the next PACE to start. ------------------ */

export function SavedPreview() {
  return (
    <div className={cx(styles.app, styles.dialog, styles.savedDialog)} aria-hidden>
      <p className={styles.dialogTitle}>Progress saved</p>
      <div className={styles.saved}>
        <span className={styles.savedMark}>
          <Check strokeWidth={2.25} />
        </span>
        <span className={styles.savedText}>
          <span className={styles.savedTitle}>
            Mathematics <span className={styles.mono}>1048</span> completed · 92%
          </span>
          <span className={styles.savedMeta}>Grace</span>
        </span>
      </div>
      <div className={styles.nextPace}>
        <span>
          Next in Mathematics: <span className={styles.mono}>1049</span>
        </span>
        <span className={cx(styles.btn, styles.btnPrimary)}>
          <Play strokeWidth={2} />
          Start 1049
        </span>
      </div>
      <div className={styles.savedActions}>
        <span className={cx(styles.btn, styles.btnSecondary)}>Log another for Grace</span>
        <span className={cx(styles.btn, styles.btnGhost)}>Done</span>
      </div>
    </div>
  )
}

/* Log progress, opened from Grace's Mathematics cell. -------------------------------------- */

export function LogPreview() {
  return (
    <div className={cx(styles.app, styles.dialog, styles.logDialog)} aria-hidden>
      <p className={styles.dialogTitle}>Log progress</p>

      <div className={styles.group}>
        <span className={styles.groupLabel}>Student</span>
        <span className={styles.chips}>
          {CHILDREN.map((child) => (
            <span key={child.name} className={cx(styles.chip, child.name === 'Grace' && styles.chipOn)}>
              <Avatar name={child.name} tone={child.tone} size="xs" />
              {child.name}
            </span>
          ))}
        </span>
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>Subject</span>
        <span className={styles.chips}>
          {SUBJECTS.map((subject) => (
            <span key={subject} className={cx(styles.chip, subject === 'Mathematics' && styles.chipOn)}>
              {subject}
              <span className={styles.chipMeta}>{CHILDREN[1].paces[subject]}</span>
            </span>
          ))}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.field}>
          <span className={styles.fieldHead}>
            <span className={styles.groupLabel}>PACE</span>
            <span className={styles.fieldAside}>Level 4</span>
          </span>
          <span className={cx(styles.input, styles.mono)}>1048</span>
        </span>
        <span className={styles.field}>
          <span className={styles.groupLabel}>What happened?</span>
          <span className={styles.segmented}>
            <span className={styles.segmentOn}>Completed</span>
            <span>Started</span>
          </span>
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.field}>
          <span className={styles.fieldHead}>
            <span className={styles.groupLabel}>Test score</span>
            <span className={styles.fieldAside}>Optional</span>
          </span>
          <span className={cx(styles.input, styles.inputFocus)}>
            <span className={styles.tabular}>92</span>
            <span className={styles.suffix}>%</span>
          </span>
        </span>
      </div>

      <div className={styles.dialogFoot}>
        <span className={styles.switchMode}>
          <Sparkles strokeWidth={1.75} />
          Type it instead
        </span>
        <span className={styles.footActions}>
          <span className={cx(styles.btn, styles.btnGhost)}>Cancel</span>
          <span className={cx(styles.btn, styles.btnPrimary)}>Save</span>
        </span>
      </div>
    </div>
  )
}

/* Home on a phone: one block per child, Log in the middle of the tab bar. ------------------ */

export function PhonePreview() {
  const shown = CHILDREN.slice(0, 2)
  return (
    <div className={cx(styles.app, styles.phone)} aria-hidden>
      <div className={styles.phoneTop}>
        <LogoMark size={20} />
        <span className={styles.phoneHousehold}>Bennett Homeschool</span>
        <Avatar name="Ruth" tone={2} />
      </div>
      <div className={styles.phoneContent}>
        <p className={styles.phoneGreeting}>Good afternoon, Ruth.</p>
        <p className={styles.phoneSummary}>
          <strong>6</strong> PACEs completed this week
        </p>
        <div className={styles.blocks}>
          {shown.map((child) => (
            <div key={child.name} className={styles.block}>
              <span className={styles.blockHead}>
                <Avatar name={child.name} tone={child.tone} />
                <span className={styles.blockName}>{child.name}</span>
                <span className={styles.blockWeek}>{child.week} PACEs this week</span>
              </span>
              <span className={styles.blockGrid}>
                {SUBJECTS.slice(0, 4).map((subject) => (
                  <span key={subject} className={styles.blockCell}>
                    <span className={styles.blockSubject}>{subject}</span>
                    <span className={styles.mono}>{child.paces[subject]}</span>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.tabbar}>
        <span className={cx(styles.tab, styles.tabOn)}>
          <House strokeWidth={2} />
          Home
        </span>
        <span className={styles.tab}>
          <Users strokeWidth={1.75} />
          Students
        </span>
        <span className={styles.tabLog}>
          <span className={styles.tabLogIcon}>
            <Plus strokeWidth={2.25} />
          </span>
          Log
        </span>
        <span className={styles.tab}>
          <Files strokeWidth={1.75} />
          Records
        </span>
        <span className={styles.tab}>
          <ScrollText strokeWidth={1.75} />
          Reports
        </span>
      </div>
    </div>
  )
}

/* A typed entry and the review that comes before anything is saved. ------------------------ */

export function AssistantPreview() {
  return (
    <div className={cx(styles.app, styles.assistant)} aria-hidden>
      <div className={cx(styles.composer, styles.composerFilled)}>
        <Sparkles strokeWidth={1.75} />
        <span>Log that Daniel completed Math PACE 1052 with a score of 92%.</span>
      </div>
      <div className={styles.review}>
        <div className={styles.reviewHead}>
          <span className={styles.reviewIcon}>
            <Sparkles strokeWidth={2} />
          </span>
          <span className={styles.reviewTitles}>
            <span className={styles.reviewTitle}>1 update detected</span>
            <span className={styles.reviewSub}>Nothing is saved until you confirm.</span>
          </span>
        </div>
        <div className={styles.change}>
          <Avatar name="Daniel" tone={0} />
          <span className={styles.changeBody}>
            <span className={styles.changeName}>Daniel</span>
            <span className={styles.changeFacts}>
              <span>
                <span className={styles.factLabel}>Subject</span>Mathematics
              </span>
              <span>
                <span className={styles.factLabel}>PACE</span>
                <span className={styles.mono}>1052</span>
              </span>
              <span>
                <span className={styles.factLabel}>Result</span>Completed · 92%
              </span>
              <span>
                <span className={styles.factLabel}>Date</span>Today
              </span>
            </span>
          </span>
        </div>
        <div className={styles.reviewActions}>
          <span className={cx(styles.btn, styles.btnPrimary)}>
            <Check strokeWidth={2} />
            Confirm update
          </span>
          <span className={cx(styles.btn, styles.btnSecondary)}>
            <Pencil strokeWidth={1.75} />
            Edit
          </span>
          <span className={cx(styles.btn, styles.btnGhost)}>Cancel</span>
        </div>
      </div>
    </div>
  )
}

/* One PACE record and its history. ----------------------------------------------------------- */

export function HistoryPreview() {
  return (
    <div className={cx(styles.app, styles.historyCard)} aria-hidden>
      <div className={styles.historyHead}>
        <span className={styles.historyTitle}>
          Mathematics <span className={styles.mono}>1048</span>
        </span>
        <span className={styles.historyMeta}>Grace · Level 4</span>
      </div>
      <dl className={styles.historyFacts}>
        <div>
          <dt>Started</dt>
          <dd>15 Sep</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>3 Oct</dd>
        </div>
        <div>
          <dt>Test score</dt>
          <dd>92%</dd>
        </div>
      </dl>
      <p className={styles.historyLabel}>History</p>
      <ol className={styles.timeline}>
        <li>
          <span className={styles.timelineDot} />
          <span className={styles.timelineText}>
            <span>Completed · 92%</span>
            <span className={styles.timelineMeta}>3 Oct · Logged via assistant</span>
          </span>
        </li>
        <li>
          <span className={styles.timelineDot} />
          <span className={styles.timelineText}>
            <span>Started</span>
            <span className={styles.timelineMeta}>15 Sep · Logged</span>
          </span>
        </li>
      </ol>
    </div>
  )
}
