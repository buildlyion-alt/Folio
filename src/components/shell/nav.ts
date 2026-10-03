import { ChartNoAxesColumn, Files, House, ScrollText, Settings, Sparkles, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Overview', items: [{ href: '/home', label: 'Home', icon: House }] },
  {
    label: 'Manage',
    items: [
      { href: '/students', label: 'Students', icon: Users },
      { href: '/progress', label: 'Progress', icon: ChartNoAxesColumn },
      { href: '/records', label: 'Records', icon: Files }
    ]
  },
  {
    label: 'Tools',
    items: [
      { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
      { href: '/reports', label: 'Reports', icon: ScrollText }
    ]
  },
  { label: 'System', items: [{ href: '/settings', label: 'Settings', icon: Settings }] }
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
