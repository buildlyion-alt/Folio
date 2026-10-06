'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import styles from './Landing.module.css'

export interface MenuLink {
  href: string
  label: string
}

/**
 * The phone navigation: a native popover, so Escape, outside clicks and focus return work
 * without extra code. The only script closes it once a section link is chosen.
 */
export function MobileMenu({ links, account }: { links: MenuLink[]; account: MenuLink }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = () => panel.current?.hidePopover()

  return (
    <>
      <button type="button" className={styles.menuButton} popoverTarget="site-menu" aria-label="Menu">
        <Menu aria-hidden strokeWidth={2} className={styles.menuOpenIcon} />
        <X aria-hidden strokeWidth={2} className={styles.menuCloseIcon} />
      </button>
      <div id="site-menu" ref={panel} popover="auto" className={styles.menuPanel}>
        <nav aria-label="Main">
          <ul className={styles.menuList}>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={styles.menuLink} onClick={close}>
                  {link.label}
                </a>
              </li>
            ))}
            <li className={styles.menuAccount}>
              <Link href={account.href} className={styles.menuLink} onClick={close}>
                {account.label}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </>
  )
}
