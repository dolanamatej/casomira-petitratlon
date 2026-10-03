// 2024 race, no names. Times and expected values come from the 2024 results
// sheet (its formulas), handRank is the place organizers wrote by hand.
// Crews 17 and 18 were marked "Open" in the Skauti block; today that is category OPEN.
// Hand ranks are only kept for Vlčata: in other blocks they were left inconsistent.
export const race2024 = [
  { startNumber: 7, category: 'Vlčata', p5: ['10:45:00', '11:17:08', 0], c2: ['12:30:00', '12:42:36'], expected: { p5: 1928, c2: 756, total: 2684 }, handRank: 6 },
  { startNumber: 11, category: 'Vlčata', p5: ['11:15:00', '11:39:52', 0], c2: ['13:00:00', '13:12:34'], expected: { p5: 1492, c2: 754, total: 2246 }, handRank: 2 },
  { startNumber: 12, category: 'Vlčata', p5: ['11:30:00', '12:06:25', 0], c2: ['13:15:00', '13:29:12'], expected: { p5: 2185, c2: 852, total: 3037 }, handRank: 9 },
  { startNumber: 15, category: 'Vlčata', p5: ['11:45:00', '12:13:17', 0], c2: ['13:30:00', '13:44:07'], expected: { p5: 1697, c2: 847, total: 2544 }, handRank: 4 },
  { startNumber: 1, category: 'Vlčata', p5: ['12:00:00', '12:33:00', 0], c2: ['13:45:00', '13:59:11'], expected: { p5: 1980, c2: 851, total: 2831 }, handRank: 7 },
  { startNumber: 19, category: 'Vlčata', p5: ['10:30:00', '10:57:17', 0], c2: ['12:15:00', '12:26:19'], expected: { p5: 1637, c2: 679, total: 2316 }, handRank: 3 },
  { startNumber: 2, category: 'Vlčata', p5: ['12:45:00', '13:21:51', 0], c2: ['11:00:00', '11:13:10'], expected: { p5: 2211, c2: 790, total: 3001 }, handRank: 8 },
  { startNumber: 20, category: 'Vlčata', p5: ['12:45:00', '13:15:50', 0], c2: ['11:00:00', '11:11:46'], expected: { p5: 1850, c2: 706, total: 2556 }, handRank: 5 },
  { startNumber: 27, category: 'Vlčata', p5: ['10:45:00', '11:08:42', 0], c2: ['12:30:00', '12:40:50'], expected: { p5: 1422, c2: 650, total: 2072 }, handRank: 1 },
  { startNumber: 8, category: 'Žabičky', p5: ['11:00:00', '11:39:48', 0], c2: ['12:45:00', '13:02:52'], expected: { p5: 2388, c2: 1072, total: 3460 } },
  { startNumber: 21, category: 'Žabičky', p5: ['12:30:00', '12:59:04', 260], c2: ['10:45:00', '10:57:00'], expected: { p5: 1484, c2: 720, total: 2204 } },
  { startNumber: 22, category: 'Žabičky', p5: ['10:30:00', '11:02:46', 0], c2: ['12:15:00', '12:29:43'], expected: { p5: 1966, c2: 883, total: 2849 } },
  { startNumber: 3, category: 'Žabičky', p5: ['13:00:00', '13:43:50', 0], c2: ['11:15:00', '11:28:44'], expected: { p5: 2630, c2: 824, total: 3454 } },
  { startNumber: 25, category: 'Žabičky', p5: ['11:15:00', '11:43:30', 127], c2: ['13:00:00', '13:12:42'], expected: { p5: 1583, c2: 762, total: 2345 } },
  { startNumber: 13, category: 'Skauti', p5: ['13:45:00', '14:13:28', 0], c2: ['12:00:00', '12:16:56'], expected: { p5: 1708, c2: 1016, total: 2724 } },
  { startNumber: 14, category: 'Skauti', p5: ['12:00:00', '12:33:01', 0], c2: ['13:45:00', '14:02:58'], expected: { p5: 1981, c2: 1078, total: 3059 } },
  { startNumber: 16, category: 'Skauti', p5: ['13:57:00', '14:32:00', 0], c2: ['13:30:00', '13:49:28'], expected: { p5: 2100, c2: 1168, total: 3268 } },
  { startNumber: 17, category: 'OPEN', p5: ['12:17:00', '12:38:00', 0], c2: ['10:31:00', '10:44:12'], expected: { p5: 1260, c2: 792, total: 2052 } },
  { startNumber: 18, category: 'OPEN', p5: ['12:17:00', '12:40:30', 0], c2: ['10:31:00', '10:44:11'], expected: { p5: 1410, c2: 791, total: 2201 } },
  { startNumber: 4, category: 'Skauti', p5: ['12:30:00', '12:56:49', 0], c2: ['10:45:00', '10:59:28'], expected: { p5: 1609, c2: 868, total: 2477 } },
  { startNumber: 23, category: 'Skauti', p5: ['13:15:00', '13:43:26', 164], c2: ['11:30:00', '11:45:36'], expected: { p5: 1542, c2: 936, total: 2478 } },
  { startNumber: 10, category: 'Skautky', p5: ['11:02:00', '11:43:17', 0], c2: ['12:45:00', '13:01:12'], expected: { p5: 2477, c2: 972, total: 3449 } },
  { startNumber: 24, category: 'Skautky', p5: ['13:30:00', '13:56:00', 125], c2: ['11:45:00', '11:59:32'], expected: { p5: 1435, c2: 872, total: 2307 } },
  { startNumber: 9, category: 'OPEN', p5: ['13:00:00', '13:46:56', 17], c2: ['11:55:00', '12:17:20'], expected: { p5: 2799, c2: 1340, total: 4139 } },
  { startNumber: 5, category: 'OPEN', p5: ['13:30:00', '14:07:25', 0], c2: ['11:45:00', '11:59:53'], expected: { p5: 2245, c2: 893, total: 3138 } },
  { startNumber: 6, category: 'OPEN', p5: ['13:15:00', '13:39:11', 0], c2: ['11:30:00', '11:43:58'], expected: { p5: 1451, c2: 838, total: 2289 } },
  { startNumber: 26, category: 'OPEN', p5: ['11:30:00', '12:01:00', 10], c2: ['13:15:00', '13:28:07'], expected: { p5: 1850, c2: 787, total: 2637 } },
] as const
