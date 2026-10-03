// Backup endpoint for the timing app. Standalone project (the sheet lives on a
// shared drive), deployed as Web app: Execute as: Me, Who has access: Anyone.
// Script properties: TOKEN, SHEET_ID. After a code change: Manage deployments → New version.
// The app sends JSON as text/plain (simple request, no CORS preflight).

const EVENT_COLUMNS = ['id', 'startNumber', 'discipline', 'type', 'timestamp',
  'waitSeconds', 'voidsEventId', 'deviceId', 'createdAt'];
const CREW_COLUMNS = ['startNumber', 'category', 'crewName', 'helmsman', 'club',
  'plannedStartP5', 'plannedStartC2', 'paid'];
// which device times which station; only that device may write its časovka columns
const STATION_COLUMNS = ['discipline', 'deviceId', 'deviceName', 'since', 'lastSeen'];

// časovka layout: A category header, B start number, C club, D crew, E helmsman,
// F–I P5 (start, finish, wait, result), J–L C2 (start, finish, result), M total, N rank.
// Each discipline owns only its columns.
const CASOVKA_SHEET = 'časovka';
const CASOVKA_COLUMNS = {
  P5: { start: 'F', finish: 'G', wait: 'H' },
  C2: { start: 'J', finish: 'K' },
};
const RESULT_FORMULA_COLUMN = 9; // I: every data row has the P5 result formula

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.token !== prop('TOKEN')) return json({ ok: false, error: 'bad token' });
  const lock = LockService.getScriptLock();
  // the app retries anyway; an answer beats Google's HTML error page
  if (!lock.tryLock(25000)) return json({ ok: false, error: 'tabulka je zaneprázdněná, zkusím znovu' });
  try {
    const ss = SpreadsheetApp.openById(prop('SHEET_ID'));
    const stations = updateStations(ss, body.station, body.takeover);
    // events are always kept: they are real button presses, even from a replaced device
    const added = appendEvents(ss, body.events || []);
    const ownsColumns = d => {
      const owner = stations.find(s => s.discipline === d);
      return !owner || (body.station && owner.deviceId === body.station.deviceId);
    };
    const crews = body.crews || [];
    upsertCrews(ss, crews);
    // časovka problems (missing block, no free row) must not block the backup itself
    const warnings = [];
    const attempt = fn => { try { fn(); } catch (err) { warnings.push(String(err.message || err)); } };
    let casovka;
    attempt(() => { casovka = new Casovka(ss); });
    if (casovka) {
      crews.forEach(c => attempt(() => casovka.writeIdentity(c)));
      (body.casovka || []).filter(u => ownsColumns(u.discipline)).forEach(u => attempt(() => casovka.writeCells(u)));
    }
    return json({ ok: true, added, warnings, stations });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e.parameter.token !== prop('TOKEN')) return json({ ok: false, error: 'bad token' });
  const ss = SpreadsheetApp.openById(prop('SHEET_ID'));
  return json({
    ok: true,
    events: readRows(ss, 'events', EVENT_COLUMNS),
    crews: readRows(ss, 'crews', CREW_COLUMNS),
    stations: readRows(ss, 'stations', STATION_COLUMNS),
  });
}

/**
 * A station is claimed by the first device timing it. Later only a takeover
 * moves it to another device; the owner just refreshes lastSeen.
 */
function updateStations(ss, station, takeover) {
  if (station) {
    const sh = table(ss, 'stations', STATION_COLUMNS);
    const rows = readRows(ss, 'stations', STATION_COLUMNS);
    const i = rows.findIndex(r => r.discipline === station.discipline);
    const now = new Date().toISOString();
    const owner = i >= 0 ? rows[i] : undefined;
    let row;
    if (!owner || takeover) row = [station.discipline, station.deviceId, station.deviceName || '', now, now];
    else if (owner.deviceId === station.deviceId) row = [owner.discipline, owner.deviceId, station.deviceName || '', owner.since, now];
    if (row) sh.getRange(i >= 0 ? i + 2 : sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  }
  return readRows(ss, 'stations', STATION_COLUMNS);
}

function appendEvents(ss, events) {
  const sh = table(ss, 'events', EVENT_COLUMNS);
  const known = new Set(sh.getRange(1, 1, sh.getLastRow(), 1).getValues().flat());
  const fresh = events.filter(ev => !known.has(ev.id) && known.add(ev.id));
  if (fresh.length) {
    const rows = fresh.map(ev => EVENT_COLUMNS.map(c => ev[c] ?? ''));
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENT_COLUMNS.length).setValues(rows);
  }
  return fresh.length;
}

function upsertCrews(ss, crews) {
  if (!crews.length) return;
  const sh = table(ss, 'crews', CREW_COLUMNS);
  const numbers = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().flat().map(String);
  for (const c of crews) {
    const row = CREW_COLUMNS.map(k => c[k] ?? '');
    const i = numbers.indexOf(String(c.startNumber));
    const at = i >= 0 ? i + 1 : (numbers.push(String(c.startNumber)), numbers.length);
    sh.getRange(at, 1, 1, row.length).setValues([row]);
  }
}

/** Rows of the human-readable sheet, found by start number or claimed in the category block. */
class Casovka {
  constructor(ss) {
    this.sh = ss.getSheetByName(CASOVKA_SHEET);
    // never auto-create časovka: a typo in the tab name must fail loudly
    if (!this.sh) throw new Error('missing sheet ' + CASOVKA_SHEET);
    const n = this.sh.getLastRow();
    this.a = this.sh.getRange(1, 1, n, 1).getValues().flat().map(v => String(v).trim().toLocaleUpperCase());
    // compare as strings: a number typed by a human may be stored as text
    this.b = this.sh.getRange(1, 2, n, 1).getValues().flat().map(String);
    this.formulas = this.sh.getRange(1, RESULT_FORMULA_COLUMN, n, 1).getFormulas().flat();
  }

  row(startNumber, category) {
    const found = this.b.indexOf(String(startNumber));
    if (found >= 0) return found + 1;
    const header = this.a.indexOf(String(category).toLocaleUpperCase());
    if (header < 0) throw new Error('časovka: chybí blok kategorie ' + category);
    for (let i = header + 1; i < this.a.length && !this.a[i]; i++) {
      if (!this.b[i] && this.formulas[i]) {
        this.b[i] = String(startNumber);
        this.sh.getRange(i + 1, 2).setValue(startNumber);
        return i + 1;
      }
    }
    throw new Error('časovka: v bloku ' + category + ' není volný řádek');
  }

  writeIdentity(c) {
    const r = this.row(c.startNumber, c.category);
    this.sh.getRange(r, 3, 1, 3).setValues([[c.club || '', c.crewName || '', c.helmsman || '']]);
  }

  writeCells(u) {
    const r = this.row(u.startNumber, u.category);
    for (const [field, value] of Object.entries(u.cells)) {
      const col = (CASOVKA_COLUMNS[u.discipline] || {})[field];
      if (col) this.sh.getRange(col + r).setValue(value);
    }
  }
}

/**
 * Wipes test data: events and crews rows, and the typed-in cells of časovka
 * (formulas stay). Run by hand from the editor. Refuses unless the script
 * property ALLOW_RESET is "yes": never set it on the live sheet.
 */
function resetTestData() {
  if (prop('ALLOW_RESET') !== 'yes') throw new Error('ALLOW_RESET is not "yes"');
  const ss = SpreadsheetApp.openById(prop('SHEET_ID'));
  for (const name of ['events', 'crews', 'stations']) {
    const sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  }
  const sh = ss.getSheetByName(CASOVKA_SHEET);
  const formulas = sh.getRange(1, RESULT_FORMULA_COLUMN, sh.getLastRow(), 1).getFormulas().flat();
  formulas.forEach((f, i) => {
    if (!f) return;
    sh.getRange(i + 1, 2, 1, 7).clearContent(); // B–H: number, club, crew, helmsman, P5 start, finish, wait
    sh.getRange(i + 1, 10, 1, 2).clearContent(); // J–K: C2 start, finish
  });
}

/** Sheet with a header row; created on first use. Plain text, so "10:30" stays a string. */
function table(ss, name, columns) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange('A:Z').setNumberFormat('@');
    sh.appendRow(columns);
  }
  return sh;
}

function readRows(ss, name, columns) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, columns.length).getValues()
    .map(r => Object.fromEntries(columns.map((c, i) => [c, r[i]])));
}

function prop(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
