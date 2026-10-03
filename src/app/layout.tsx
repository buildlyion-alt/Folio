import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { themeBootScript } from '@/lib/theme'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Folio', template: '%s · Folio' },
  description: 'Homeschool records and PACE progress for A.C.E. families.',
  applicationName: 'Folio'
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c110b' }
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme is set before paint by the boot script, so the server markup can't know it.
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
