import { CATEGORIES, type Crew } from './types.ts'

/** RFC 4180-ish: quoted fields, "" escapes, CRLF. Delimiter is ',' or ';' (Czech Excel). */
function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const delimiter = text.split('\n')[0].includes(';') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** Signed-up crews (no start number yet). All-or-nothing: any error imports nothing. */
export function importCrews(text: string): { crews: Crew[]; errors: string[] } {
  const [header, ...rows] = parseCsv(text)
  const col = (name: string) => header.indexOf(name)
  const missing = ['category', 'crew_name', 'helmsman', 'club'].filter(c => col(c) < 0)
  if (missing.length) return { crews: [], errors: [`Chybí sloupce: ${missing.join(', ')}`] }

  const crews: Crew[] = [], errors: string[] = []
  rows.forEach((r, i) => {
    if (r.every(f => !f.trim())) return
    const raw = r[col('category')] ?? ''
    // spreadsheets write "Open" or "open", the app knows OPEN
    const category = CATEGORIES.find(c => c.toLocaleLowerCase('cs') === raw.trim().toLocaleLowerCase('cs'))
    if (!category) {
      errors.push(`Řádek ${i + 2}: neznámá kategorie „${raw}“`)
      return
    }
    crews.push({
      category,
      crewName: r[col('crew_name')]?.trim() ?? '',
      helmsman: r[col('helmsman')]?.trim() ?? '',
      club: r[col('club')]?.trim() ?? '',
    })
  })
  return errors.length ? { crews: [], errors } : { crews, errors }
}
