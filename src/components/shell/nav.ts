import { Files, House, ScrollText, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/** The whole mental model: four places. Settings and the account live quietly at the bottom. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home', icon: House },
  { href: '/students', label: 'Students', icon: Users },
  { href: '/records', label: 'Records', icon: Files },
  { href: '/reports', label: 'Reports', icon: ScrollText }
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
