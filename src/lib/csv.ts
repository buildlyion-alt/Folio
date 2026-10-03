/** One CSV cell: quoted when needed, with spreadsheet formula injection neutralized. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** A UTF-8 CSV download (with BOM so spreadsheet apps detect the encoding). */
export function csvResponse(filename: string, rows: Array<Array<string | number | null | undefined>>): Response {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  return new Response(`﻿${body}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      'Cache-Control': 'no-store'
    }
  })
}
