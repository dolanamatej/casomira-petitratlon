import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importCrews } from './csv.ts'

test('imports crews from a comma CSV with quoted fields', () => {
  const { crews, errors } = importCrews('category,crew_name,helmsman,club\nVlčata,"Bobři, s.r.o.",Krab,Štiky\n')
  assert.deepEqual(errors, [])
  assert.deepEqual(crews, [{ category: 'Vlčata', crewName: 'Bobři, s.r.o.', helmsman: 'Krab', club: 'Štiky' }])
})

test('imports a semicolon CSV with BOM as saved by Czech Excel', () => {
  const { crews } = importCrews('﻿category;crew_name;helmsman;club\r\nOPEN;Victoria;Filip;Lososi\r\n')
  assert.deepEqual(crews, [{ category: 'OPEN', crewName: 'Victoria', helmsman: 'Filip', club: 'Lososi' }])
})

test('matches categories regardless of case and surrounding spaces', () => {
  const { crews, errors } = importCrews('category,crew_name,helmsman,club\nOpen,A,B,C\n roveři ,D,E,F\nROVERKY,G,H,I\n')
  assert.deepEqual(errors, [])
  assert.deepEqual(crews.map(c => c.category), ['OPEN', 'Roveři', 'Roverky'])
})

test('rejects an unknown category with its line number and imports nothing', () => {
  const { crews, errors } = importCrews('category,crew_name,helmsman,club\nVlčata,A,B,C\nSvětlušky,D,E,F\n')
  assert.deepEqual(crews, [])
  assert.deepEqual(errors, ['Řádek 3: neznámá kategorie „Světlušky“'])
})
