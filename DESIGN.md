---
name: Folio
description: A calm record folder for A.C.E. homeschool families.
colors:
  folder-black: "#0c110b"
  mint-canvas: "#f0f9f4"
  paper-white: "#ffffff"
  mist: "#f5faf7"
  sage-wash: "#ebf3ed"
  sage-tint: "#d2e3d1"
  signal-green: "#4cc264"
  signal-green-hover: "#5acd71"
  deep-green-text: "#1e7b37"
  green-wash: "#e2f4e6"
  ink-text: "#0c110b"
  moss-text: "#3f4d42"
  lichen-text: "#5b695e"
  hairline: "#dde8df"
  hairline-faint: "#e8f0ea"
  field-stroke: "#c2d2c5"
  ochre-mark: "#b97800"
  ochre-text: "#9a5b00"
  brick: "#c2362b"
  night-canvas: "#0c110b"
  night-surface: "#121a13"
  night-text: "#e8f2ea"
  night-green-text: "#6fd486"
  night-ochre: "#e8b45c"
typography:
  headline:
    fontFamily: "Geist, -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "34px"
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "Geist, -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  meta:
    fontFamily: "Geist, -apple-system, 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  data:
    fontFamily: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
    fontFeature: "'tnum' 1"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  full: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal-green}"
    textColor: "{colors.folder-black}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.signal-green-hover}"
  button-ink:
    backgroundColor: "{colors.folder-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  button-ghost:
    textColor: "{colors.moss-text}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  input:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  chip-selected:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  list-surface:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.xl}"
  nav-item-active:
    backgroundColor: "#1c2b1f"
    textColor: "#eef5ef"
    rounded: "{rounded.md}"
    height: "40px"
---

# Design System: Folio

## Overview

**Creative North Star: "The Calm Record Folder"**

Folio is the paper record folder a homeschooling parent used to keep, made quiet and quick. Every screen answers one of three questions, in order: how are my children doing, what is each of them working on, and how do I record what just happened. The interface stays out of the way: a near-black green rail on the left, a mint canvas, white working surfaces, and one green signal that marks the thing to do next. It should feel like a well-kept folder on the kitchen table, not an analytics product.

Density is moderate and even. Lists and tables carry the content; cards are not used as decoration, and nothing is boxed twice. Secondary detail waits behind a click (a subject's full results, the "More filters" row, a record's history), so the first look is always short. The product follows the device's light or dark setting by default, and both themes use the same token names.

**Key Characteristics:**
- One green signal per screen; everything else is neutral, tinted toward the same green.
- Children first: names and current PACE numbers lead every overview.
- Lists on a single white surface with hairline rows, never grids of cards.
- PACE numbers set in Geist Mono so columns of numbers scan cleanly.
- Exceptions are marked quietly with a small ochre dot and plain words ("Needs a look").

## Colors

A green-black and mint palette with a single bright green signal and one muted ochre for exceptions.

### Primary
- **Signal Green** (#4cc264): the primary action in view (Log progress, Save in the log dialog, Confirm on an AI preview), the active navigation icon, the completed-status dot. Text on it is Folder Black (8.5:1).
- **Deep Green Text** (#1e7b37): green as text or a thin line on light surfaces: text links ("All of Gabriel's records"), quiet actions ("Log retest"), selected-chip borders, the focus ring. Night Green Text (#6fd486) takes the role in the dark theme.
- **Green Wash** (#e2f4e6): the fill of a selected chip or option.

### Neutral
- **Folder Black** (#0c110b): the sidebar in both themes, primary text, and the Ink button.
- **Mint Canvas** (#f0f9f4): the page ground in the light theme.
- **Paper White** (#ffffff): working surfaces: lists, tables, dialogs, fields.
- **Mist** (#f5faf7) and **Sage Wash** (#ebf3ed): row hover, the open row of an accordion, segmented-control tracks.
- **Sage Tint** (#d2e3d1): text selection.
- **Moss Text** (#3f4d42) and **Lichen Text** (#5b695e): secondary and tertiary text; Lichen holds 5.8:1 on white and is the floor for any readable text, placeholders included.
- **Hairline** (#dde8df), **Hairline Faint** (#e8f0ea), **Field Stroke** (#c2d2c5): row dividers, surface outlines, and input borders.

### Status
- **Ochre Mark** (#b97800): the "needs a look" dot (3.6:1 on white). **Ochre Text** (#9a5b00) when the warning is written out.
- **Brick** (#c2362b): scores below the pass mark and destructive actions.

### Named Rules
**The One Signal Rule.** Signal Green appears on at most one control per screen. Page-level actions that sit beside the always-visible Log progress button (Add student, Save changes, Print) use the Ink button instead.

**The Tinted Neutral Rule.** No pure grays. Every neutral leans toward the green family so the sidebar, canvas and text read as one material.

## Typography

**Body Font:** Geist (with -apple-system, Segoe UI, system-ui)
**Data Font:** Geist Mono, for PACE numbers and other identifiers only

**Character:** One quiet sans carries every role; the mono face appears only where numbers need to line up.

### Hierarchy
- **Headline** (600, 28px, 34px): page titles and the Home greeting. 24px on phones.
- **Title** (600, 17px, 24px): section headings on the canvas ("What everyone is working on").
- **Body** (400, 15px, 22px): primary content: names, subjects, results, sentences.
- **Label** (500, 14px, 20px): buttons, chips, form labels, table cells in dense tables.
- **Meta** (400, 13px, 18px): dates, hints, column headers, counts.
- **Data** (Geist Mono 400, 15px): PACE numbers in tables, cells and dialogs.

### Named Rules
**The No Kicker Rule.** Nothing sits above a heading except a breadcrumb on a deep page ("Students /"). Step names, letterheads and category labels go below the heading or into the meta line.

## Layout

A fixed 240px rail on the left at 960px and wider; below that, a 56px top bar and a 64px bottom tab bar whose center button is Log progress. Content is left-aligned at a 1120px maximum with 40px side padding (32px under 1180px, 16px on phones); a student profile narrows to 880px and a report to 920px so short tables stay readable. Spacing follows a 4px grid: 32px between sections, 12px from a section heading to its content, 20px inside surfaces. Home's matrix becomes one block per child below 800px, with each subject's name above its PACE number so nothing truncates at 360px.

## Elevation & Depth

Flat at rest. Depth comes from tone (mint canvas, white surface, mist hover) and hairlines, not shadows. Shadows exist only on layers that float above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px rgba(12,17,11,0.10), 0 1px 3px rgba(12,17,11,0.08)`): menus, the command bar, toasts.
- **Dialog** (`box-shadow: 0 24px 64px rgba(12,17,11,0.18), 0 2px 8px rgba(12,17,11,0.08)`): dialogs over a scrim of rgba(12,17,11,0.42).

### Named Rules
**The Flat Surface Rule.** A surface that does not float has no shadow; a white list on the mint canvas is defined by its 1px faint hairline alone.

## Shapes

Gently rounded and consistent: 8px on controls (buttons, fields, chips, table cells that act as buttons), 12px on surfaces (lists, tables, dialogs), full rounding only on avatars, status dots and the mobile Log button. Borders are 1px hairlines. There are no side stripes or thick accent borders.

## Components

### Buttons
- **Shape:** gently curved (8px), 36px tall (30px small, 40px large, 44px touch targets on phones).
- **Primary:** Signal Green with Folder Black text; one per screen.
- **Ink:** Folder Black with white text, for a page's own main action beside Log progress.
- **Secondary:** white with a 1px stronger hairline; **Ghost:** text only, Moss Text, with a faint wash on hover.
- **Hover / Focus:** fills shift one step in 120ms; focus shows a 2px Deep Green Text ring.

### Chips
- **Style:** white with Field Stroke border, Moss Text label, optional mono meta (the current PACE).
- **State:** selected chips take Green Wash with a Deep Green Text border, so the choice is visible without relying on color alone.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper White on Mint Canvas.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Hairline Faint; full Hairline in the dark theme.
- **Internal Padding:** 20px; list rows run edge to edge with hairline dividers instead of padding boxes.

### Inputs / Fields
- **Style:** white, 1px Field Stroke, 8px radius, 36px tall (44px and 16px text on phones). The caret is Deep Green Text.
- **Focus:** border and a 2px ring in Deep Green Text.
- **Error / Disabled:** Brick message under the field; disabled controls drop to 45% opacity with a not-allowed cursor.

### Navigation
- **Rail:** four destinations (Home, Students, Records, Reports) at 15px; the active item takes a slightly lighter green-black fill, white text and a Signal Green icon. Settings and the account menu sit quietly at the bottom; search opens the command bar (Ctrl/Cmd K).
- **Phone:** the same four destinations in a bottom tab bar, with the Log button raised in the center as a Signal Green pill.

### The PACE Matrix (signature)
Home's table of children by subject: one row per child, one column per subject, each cell the current PACE number in Geist Mono. Selecting a cell opens Log progress already filled in for that child, subject and PACE, so recording a result takes one click and two keys. Cells that need attention carry a 7px Ochre Mark dot, explained in the "Needs a look" list below the table.

## Do's and Don'ts

### Do:
- **Do** lead every overview with the children's names and current PACE numbers.
- **Do** keep Signal Green for the one action to take next; use Ink for other page-level primaries.
- **Do** put secondary detail behind a disclosure (accordion row, "More filters", record dialog) instead of showing it all at once.
- **Do** write results the way a parent says them: "Mathematics 1084 · 94% · Oct 3".
- **Do** keep readable text at Lichen Text (#5b695e) or darker in the light theme.

### Don't:
- **Don't** build screens from stat cards, charts, activity feeds or insight panels; Folio is not an analytics dashboard.
- **Don't** put a kicker, step label or letterhead above a heading.
- **Don't** wrap individual values in their own cards or add borders around every group.
- **Don't** add shadows to surfaces that do not float.
- **Don't** create new top-level destinations; new features live inside Home, Students, Records or Reports.
