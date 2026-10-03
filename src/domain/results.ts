import { crewDiscipline, type CrewDiscipline } from './crewDiscipline.ts'
import { CATEGORIES, type Category, type Crew, type Event } from './types.ts'

export interface ResultRow {
  startNumber: number
  crew: Crew
  p5: CrewDiscipline
  c2: CrewDiscipline
  /** Only when both disciplines are finished. */
  total?: number
  /** Shared on equal totals (2., 2., 4.); missing for crews without total. */
  rank?: number
}

export function computeResults(crews: Crew[], events: Event[]): { category: Category; rows: ResultRow[] }[] {
  const rows = crews.filter(c => c.startNumber !== undefined).map((crew): ResultRow => {
    const startNumber = crew.startNumber!
    const p5 = crewDiscipline(events, startNumber, 'P5')
    const c2 = crewDiscipline(events, startNumber, 'C2')
    const total = p5.seconds !== undefined && c2.seconds !== undefined ? p5.seconds + c2.seconds : undefined
    return { startNumber, crew, p5, c2, total }
  })

  return CATEGORIES.map(category => {
    const inCategory = rows.filter(r => r.crew.category === category)
    const totals = inCategory.flatMap(r => (r.total === undefined ? [] : [r.total]))
    for (const r of inCategory) {
      if (r.total !== undefined) r.rank = 1 + totals.filter(t => t < r.total!).length
    }
    // unranked crews go last, by start number
    inCategory.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.startNumber - b.startNumber)
    return { category, rows: inCategory }
  }).filter(c => c.rows.length > 0)
}
