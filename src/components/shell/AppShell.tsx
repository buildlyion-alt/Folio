'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { Suspense, useTransition, type ReactNode } from 'react'
import { ChevronsUpDown, LogOut, Moon, Plus, Search, Settings, Sun } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { LogoMark } from '@/components/brand/Logo'
import { useCommandBar } from '@/components/command/CommandProvider'
import { useLogProgress } from '@/components/log/LogProgressProvider'
import { RecordDialogHost } from '@/components/records/RecordDialog'
import { useAppData } from '@/components/providers/AppData'
import { Button } from '@/components/ui/Button'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { Avatar, Kbd } from '@/components/ui/Misc'
import { cx } from '@/lib/cx'
import { useResolvedTheme, useThemePreference } from '@/lib/useTheme'
import { NAV_ITEMS, isActive } from './nav'
import styles from './AppShell.module.css'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const params = useParams<{ studentId?: string }>()
  const openCommand = useCommandBar()
  const openLog = useLogProgress()
  const { household, user } = useAppData()
  const [signingOut, startSignOut] = useTransition()
  const theme = useResolvedTheme()
  const [, setThemePreference] = useThemePreference()

  // On a student's page, logging starts with that student chosen.
  const logProgress = () => openLog(params.studentId ? { studentId: params.studentId } : undefined)

  const accountItems: MenuItem[] = [
    theme === 'dark'
      ? { label: 'Light mode', icon: Sun, onSelect: () => setThemePreference('light') }
      : { label: 'Dark mode', icon: Moon, onSelect: () => setThemePreference('dark') },
    { label: signingOut ? 'Signing out…' : 'Sign out', icon: LogOut, onSelect: () => startSignOut(() => signOut()), separatorBefore: true }
  ]

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className={styles.sidebar} aria-label="Sidebar">
        <Link href="/home" className={styles.brand}>
          <LogoMark size={24} />
          <span className={styles.brandText}>
            <span className={styles.brandWord}>Folio</span>
            <span className={styles.household}>{household.name}</span>
          </span>
        </Link>
        {household.isDemo ? <p className={styles.demoTag}>Demo data</p> : null}

        <Button variant="primary" size="lg" icon={Plus} block onClick={logProgress} className={styles.logButton}>
          Log progress
        </Button>

        <button type="button" className={styles.search} onClick={() => openCommand()}>
          <Search aria-hidden strokeWidth={1.75} />
          <span className={styles.searchText}>Search</span>
          <span className={styles.searchKeys} aria-hidden>
            <Kbd>⌘K</Kbd>
          </span>
        </button>

        <nav className={styles.nav} aria-label="Main">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navItem} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
                  <item.icon aria-hidden strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFoot}>
          <Link href="/settings" className={styles.navItemQuiet} aria-current={isActive(pathname, '/settings') ? 'page' : undefined}>
            <Settings aria-hidden strokeWidth={1.75} />
            Settings
          </Link>
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
            items={accountItems}
            trigger={(props) => (
              <button type="button" className={styles.accountButton} {...props} aria-label={`Account: ${user.name}`}>
                <Avatar initials={user.initials} seed={user.email} size="sm" />
                <span className={styles.accountName}>{user.name}</span>
                <ChevronsUpDown className={styles.accountChevron} aria-hidden strokeWidth={1.75} />
              </button>
            )}
          />
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.mobileTop}>
          <Link href="/home" className={styles.mobileBrand}>
            <LogoMark size={22} />
            <span className={styles.mobileHousehold}>{household.name}</span>
          </Link>
          {household.isDemo ? <span className={styles.mobileDemo}>Demo</span> : null}
          <Button variant="ghost" iconOnly size="lg" icon={Search} aria-label="Search" onClick={() => openCommand()} />
          <Menu
            label="Account"
            side="bottom"
            align="end"
            header={
              <div className={styles.menuHeader}>
                <span className={styles.menuName}>{user.name}</span>
                <span className={styles.menuEmail}>{user.email}</span>
              </div>
            }
            items={[{ label: 'Settings', icon: Settings, href: '/settings' }, ...accountItems]}
            trigger={(props) => (
              <button type="button" className={styles.mobileAccount} {...props} aria-label={`Account: ${user.name}`}>
                <Avatar initials={user.initials} seed={user.email} size="sm" />
              </button>
            )}
          />
        </header>

        <main id="main" className={styles.content} tabIndex={-1}>
          {children}
        </main>
        <Suspense fallback={null}>
          <RecordDialogHost />
        </Suspense>
      </div>

      <nav className={styles.tabbar} aria-label="Main">
        <TabLink item={NAV_ITEMS[0]} pathname={pathname} />
        <TabLink item={NAV_ITEMS[1]} pathname={pathname} />
        <button type="button" className={styles.tabLog} onClick={logProgress} aria-label="Log progress">
          <span className={styles.tabLogIcon}>
            <Plus aria-hidden strokeWidth={2.25} />
          </span>
          <span className={styles.tabLabel}>Log</span>
        </button>
        <TabLink item={NAV_ITEMS[2]} pathname={pathname} />
        <TabLink item={NAV_ITEMS[3]} pathname={pathname} />
      </nav>
    </div>
  )
}

function TabLink({ item, pathname }: { item: (typeof NAV_ITEMS)[number]; pathname: string }) {
  const active = isActive(pathname, item.href)
  return (
    <Link href={item.href} className={cx(styles.tab)} aria-current={active ? 'page' : undefined}>
      <item.icon aria-hidden strokeWidth={active ? 2 : 1.75} />
      <span className={styles.tabLabel}>{item.label}</span>
    </Link>
  )
}
