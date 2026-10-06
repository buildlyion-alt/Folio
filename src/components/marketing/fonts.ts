import localFont from 'next/font/local'

/*
 * The brand faces from the Folio design system (SIL Open Font License, see ./fonts).
 * Loaded only by the marketing page, so the signed-in app keeps its own type.
 *
 *   Bricolage Grotesque         major headings
 *   Atkinson Hyperlegible Next  body, buttons, navigation, numbers, UI text
 */

export const bricolage = localFont({
  src: './fonts/BricolageGrotesque-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-display'
})

export const atkinson = localFont({
  src: './fonts/AtkinsonHyperlegibleNext-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-text'
})
