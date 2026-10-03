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

test('rejects an unknown category with its line number and imports nothing', () => {
  const { crews, errors } = importCrews('category,crew_name,helmsman,club\nVlčata,A,B,C\nskauti ,D,E,F\n')
  assert.deepEqual(crews, [])
  assert.deepEqual(errors, ['Řádek 3: neznámá kategorie „skauti “'])
})
