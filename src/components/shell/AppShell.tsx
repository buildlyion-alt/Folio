'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useState, useTransition, type ReactNode } from 'react'
import { ChevronsUpDown, Ellipsis, House, LogOut, Plus, Search, Settings, Sparkles, Users } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { LogoMark } from '@/components/brand/Logo'
import { useCommandBar } from '@/components/command/CommandProvider'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { RecordDialogHost } from '@/components/records/RecordDialog'
import { useAppData } from '@/components/providers/AppData'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { Avatar, Kbd } from '@/components/ui/Misc'
import { cx } from '@/lib/cx'
import { NAV_GROUPS, isActive } from './nav'
import styles from './AppShell.module.css'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const openCommand = useCommandBar()
  const openLog = useLogProgress()
  const { household, user } = useAppData()
  const [moreOpen, setMoreOpen] = useState(false)
  const [signingOut, startSignOut] = useTransition()

  const doSignOut = () => startSignOut(() => signOut())

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className={styles.sidebar} aria-label="Sidebar">
        <Link href="/home" className={styles.brand} aria-label="Folio home">
          <LogoMark size={20} />
          <span className={styles.brandWord}>Folio</span>
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <p className={styles.groupLabel}>{group.label}</p>
              <ul>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={styles.navItem}
                        aria-current={active ? 'page' : undefined}
                        title={item.label}
                      >
                        <item.icon aria-hidden strokeWidth={1.75} />
                        <span className={styles.navLabel}>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.account}>
          <Menu
            label="Account"
            side="top"
            align="stretch"
            block
            header={
              <div className={styles.menuHeader}>
                <span className={styles.menuName}>{user.name}</span>
                <span className={styles.menuEmail}>{user.email}</span>
              </div>
            }
            items={[
              { label: 'Settings', icon: Settings, href: '/settings' },
              { label: signingOut ? 'Signing out…' : 'Sign out', icon: LogOut, onSelect: doSignOut, separatorBefore: true }
            ]}
            trigger={(props) => (
              <button type="button" className={styles.accountButton} {...props} aria-label={`Account: ${user.name}`}>
                <Avatar initials={user.initials} seed={user.email} size="md" />
                <span className={styles.accountText}>
                  <span className={styles.accountName}>{user.name}</span>
                  <span className={styles.accountHousehold}>{household.name}</span>
                </span>
                <ChevronsUpDown className={styles.accountChevron} aria-hidden strokeWidth={1.75} />
              </button>
            )}
          />
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.search} onClick={() => openCommand()} aria-label="Search or tell Folio what happened">
            <Search aria-hidden strokeWidth={1.75} />
            <span className={styles.searchText}>Search, or tell Folio what happened…</span>
            <span className={styles.searchKeys} aria-hidden>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className={styles.topActions}>
            {household.isDemo ? <span className={styles.demoTag}>Demo data</span> : null}
            <Button variant="primary" icon={Plus} onClick={() => openLog()}>
              Log progress
            </Button>
          </div>
        </header>

        <header className={styles.mobileTop}>
          <Link href="/home" className={styles.mobileBrand} aria-label="Folio home">
            <LogoMark size={20} />
            <span className={styles.mobileHousehold}>{household.name}</span>
          </Link>
          <Button variant="ghost" iconOnly size="lg" icon={Search} aria-label="Search" onClick={() => openCommand()} />
        </header>

        <main id="main" className={styles.content} tabIndex={-1}>
          {children}
        </main>
        <Suspense fallback={null}>
          <RecordDialogHost />
        </Suspense>
      </div>

      <nav className={styles.tabbar} aria-label="Main">
        <TabLink href="/home" label="Home" icon={House} pathname={pathname} />
        <TabLink href="/students" label="Students" icon={Users} pathname={pathname} />
        <button type="button" className={styles.tabLog} onClick={() => openLog()} aria-label="Log progress">
          <span className={styles.tabLogIcon}>
            <Plus aria-hidden strokeWidth={2.25} />
          </span>
          <span className={styles.tabLabel}>Log</span>
        </button>
        <TabLink href="/assistant" label="Assistant" icon={Sparkles} pathname={pathname} />
        <button
          type="button"
          className={styles.tab}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-current={['/progress', '/records', '/reports', '/settings'].some((h) => isActive(pathname, h)) ? 'page' : undefined}
        >
          <Ellipsis aria-hidden strokeWidth={1.75} />
          <span className={styles.tabLabel}>More</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <ul className={styles.moreList}>
          {NAV_GROUPS.flatMap((g) => g.items)
            .filter((item) => !['/home', '/students', '/assistant'].includes(item.href))
            .map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.moreItem}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                >
                  <item.icon aria-hidden strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            ))}
        </ul>
        <div className={styles.moreAccount}>
          <Avatar initials={user.initials} seed={user.email} size="lg" />
          <span className={styles.accountText}>
            <span className={styles.accountName}>{user.name}</span>
            <span className={styles.accountHousehold}>{household.name}</span>
          </span>
          <Button variant="ghost" icon={LogOut} onClick={doSignOut} loading={signingOut}>
            Sign out
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function TabLink({
  href,
  label,
  icon: Icon,
  pathname
}: {
  href: string
  label: string
  icon: typeof House
  pathname: string
}) {
  const active = isActive(pathname, href)
  return (
    <Link href={href} className={cx(styles.tab)} aria-current={active ? 'page' : undefined}>
      <Icon aria-hidden strokeWidth={1.75} />
      <span className={styles.tabLabel}>{label}</span>
    </Link>
  )
}
