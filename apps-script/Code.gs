// Backup endpoint for the timing app. Deploy as Web app:
// Execute as: Me, Who has access: Anyone. Set Script property TOKEN.
// Standalone script (the sheet lives on a shared drive): set Script property SHEET_ID.
// The app sends JSON as text/plain (simple request, no CORS preflight).

const EVENT_COLUMNS = ['id', 'startNumber', 'discipline', 'type', 'timestamp',
  'waitSeconds', 'voidsEventId', 'deviceId', 'createdAt'];

// Each discipline owns only its columns in the human-readable časovka sheet.
const CASOVKA_COLUMNS = {
  P5: { start: 'F', finish: 'G', wait: 'H' },
  C2: { start: 'J', finish: 'K' },
};
const START_NUMBER_COLUMN = 2; // B
const CASOVKA_SHEET = 'časovka';

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.token !== PropertiesService.getScriptProperties().getProperty('TOKEN')) {
    return json({ ok: false, error: 'bad token' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const added = appendEvents(body.events || []);
    const written = writeCasovka(body.casovka || []);
    return json({ ok: true, added, written });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e.parameter.token !== PropertiesService.getScriptProperties().getProperty('TOKEN')) {
    return json({ ok: false, error: 'bad token' });
  }
  const rows = sheet('events').getDataRange().getValues().slice(1);
  const events = rows.map(r => Object.fromEntries(EVENT_COLUMNS.map((c, i) => [c, r[i]])));
  return json({ ok: true, events });
}

function appendEvents(events) {
  const sh = sheet('events');
  if (sh.getLastRow() === 0) sh.appendRow(EVENT_COLUMNS);
  const known = new Set(sh.getRange(1, 1, sh.getLastRow(), 1).getValues().flat());
  const fresh = events.filter(ev => !known.has(ev.id) && known.add(ev.id));
  if (fresh.length) {
    const rows = fresh.map(ev => EVENT_COLUMNS.map(c => ev[c] ?? ''));
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENT_COLUMNS.length).setValues(rows);
  }
  return fresh.length;
}

// ponytail: only updates rows that already carry the start number;
// claiming a free row for an extra crew comes with the real časovka layout.
function writeCasovka(cells) {
  if (!cells.length) return 0;
  // never auto-create časovka: a typo in the tab name must fail loudly
  const sh = SpreadsheetApp.openById(sheetId()).getSheetByName(CASOVKA_SHEET);
  if (!sh) throw new Error('missing sheet ' + CASOVKA_SHEET);
  // compare as strings: a number typed by a human may be stored as text
  const numbers = sh.getRange(1, START_NUMBER_COLUMN, sh.getLastRow(), 1).getValues().flat().map(String);
  let written = 0;
  for (const c of cells) {
    const col = (CASOVKA_COLUMNS[c.discipline] || {})[c.field];
    const row = numbers.indexOf(String(c.startNumber)) + 1;
    if (!col || !row) continue;
    sh.getRange(col + row).setValue(c.value);
    written++;
  }
  return written;
}

function sheet(name) {
  const ss = SpreadsheetApp.openById(sheetId());
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function sheetId() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
