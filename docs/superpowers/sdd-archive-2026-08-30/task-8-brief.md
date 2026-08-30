## Task 8: Summary aggregation — pure + Node tests

**Files:**
- Create: `Summary.js` (pure section only)
- Create: `tests/summary.test.js`

**Interfaces:**
- Consumes: `COL` (global; test sets it), `isDone_` (global; test sets it).
- Produces:
  - `dateInTz_(dateObj, tz) -> 'yyyy-MM-dd'` — uses `Utilities.formatDate` when available, else UTC ISO date (Node tests pass UTC dates).
  - `aggregateSummary_(logRows, dataRowsBySheet, dateStr, tz) -> [{secretary, done, sent, untick, avgMinutes, oldestPendingHours}]`, sorted by `secretary`.
    - `logRows`: array of `[timestamp, sheet, code, username, secretaryName, action, oldValue, newValue]`.
    - `dataRowsBySheet`: `{ sheetName: [ [A..O], ... ] }` raw values.
    - Counts `done`/`sent`/`untick` from log rows whose timestamp is on `dateStr`; `untick` = a log row with `newValue === ''`.
    - `avgMinutes`: mean of `(SentAt - DoneAt)` in minutes over data rows whose `SentAt` is on `dateStr`; `null` if none.
    - `oldestPendingHours`: max age in hours of a data row with no `Done`, per secretary, using current time.

- [ ] **Step 1: Write the failing test — `tests/summary.test.js`**

```js
const assert = require('node:assert');
global.COL = { TIMESTAMP: 0, SECRETARIAT: 8, DONE: 9, DONE_AT: 11, SENT_AT: 13 };
global.isDone_ = v => String(v || '').trim().toLowerCase() === 'done';
const { aggregateSummary_ } = require('../Summary.js');

const D = '2026-08-30';
function iso(s) { return new Date(s + 'Z'); } // force UTC

const logRows = [
  [iso('2026-08-30T08:00:00'), 'UploadedData', 'C-1', 'h1', 'حصة الردهان', 'done', '', 'Done'],
  [iso('2026-08-30T09:00:00'), 'UploadedData', 'C-1', 'h1', 'حصة الردهان', 'sent', '', 'Sent'],
  [iso('2026-08-30T09:30:00'), 'UploadedData', 'C-2', 'h1', 'حصة الردهان', 'done', '', 'Done'],
  [iso('2026-08-30T10:00:00'), 'UploadedData', 'C-2', 'h1', 'حصة الردهان', 'done', 'Done', ''], // un-tick
  [iso('2026-08-29T09:00:00'), 'UploadedData', 'C-9', 'w1', 'وضحة الحجرف', 'done', '', 'Done'], // other day, ignored
];

function drow(opts) {
  const r = new Array(15).fill('');
  r[0] = opts.ts || '';
  r[8] = opts.sec || '';
  r[9] = opts.done || '';
  r[11] = opts.doneAt || '';
  r[13] = opts.sentAt || '';
  return r;
}
const data = {
  UploadedData: [
    drow({ sec: 'حصة الردهان', done: 'Done', doneAt: iso('2026-08-30T08:00:00'), sentAt: iso('2026-08-30T09:00:00') }), // 60 min
    drow({ sec: 'حصة الردهان', ts: iso('2000-01-01T00:00:00') }), // ancient pending
    drow({ sec: 'وضحة الحجرف', ts: new Date(Date.now() - 3 * 3600 * 1000) }), // ~3h pending
  ],
};

const out = aggregateSummary_(logRows, data, D, 'UTC');
const hessa = out.find(r => r.secretary === 'حصة الردهان');
const wadha = out.find(r => r.secretary === 'وضحة الحجرف');

assert.strictEqual(hessa.done, 2);       // two 'done' set events on D
assert.strictEqual(hessa.sent, 1);
assert.strictEqual(hessa.untick, 1);
assert.strictEqual(hessa.avgMinutes, 60);
assert.ok(hessa.oldestPendingHours > 100000); // year-2000 row
assert.strictEqual(wadha.done, 0);       // only had an event on the 29th
assert.strictEqual(wadha.avgMinutes, null);
assert.ok(wadha.oldestPendingHours >= 2.9 && wadha.oldestPendingHours <= 3.1);

// sorted by secretary name
assert.deepStrictEqual(out.map(r => r.secretary), [...out.map(r => r.secretary)].sort());

console.log('summary.test.js OK');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/summary.test.js`
Expected: FAIL — `Cannot find module '../Summary.js'`.

- [ ] **Step 3: Create `Summary.js` pure section**

```js
/**
 * Admin summary: per-secretary Done/Sent/un-tick counts for a given day,
 * average Done->Sent minutes for that day, and the oldest still-pending
 * request age. Pure aggregation + a thin getAdminSummary wrapper.
 */

function dateInTz_(dateObj, tz) {
  if (typeof Utilities !== 'undefined' && Utilities && Utilities.formatDate) {
    return Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd');
  }
  return dateObj.toISOString().slice(0, 10); // Node tests use UTC dates
}

function aggregateSummary_(logRows, dataRowsBySheet, dateStr, tz) {
  var perSec = {};
  function bucket(name) {
    if (!perSec[name]) {
      perSec[name] = { secretary: name, done: 0, sent: 0, untick: 0, _lat: [], oldestPendingHours: 0 };
    }
    return perSec[name];
  }
  function asDate(v) {
    if (v instanceof Date) return v;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  (logRows || []).forEach(function (r) {
    var when = asDate(r[0]);
    if (!when || dateInTz_(when, tz) !== dateStr) return;
    var sec = String(r[4] == null ? '' : r[4]).trim();
    if (!sec) return;
    var action = String(r[5] || '');
    var newVal = String(r[7] == null ? '' : r[7]);
    var b = bucket(sec);
    if (newVal === '') { b.untick++; return; }
    if (action === 'done') b.done++;
    else if (action === 'sent') b.sent++;
  });

  Object.keys(dataRowsBySheet || {}).forEach(function (sheetName) {
    dataRowsBySheet[sheetName].forEach(function (row) {
      var s = asDate(row[COL.SENT_AT]);
      var d = asDate(row[COL.DONE_AT]);
      if (s && d && dateInTz_(s, tz) === dateStr) {
        var sec = String(row[COL.SECRETARIAT] == null ? '' : row[COL.SECRETARIAT]).trim();
        if (sec) bucket(sec)._lat.push((s.getTime() - d.getTime()) / 60000);
      }
    });
  });

  var now = Date.now();
  Object.keys(dataRowsBySheet || {}).forEach(function (sheetName) {
    dataRowsBySheet[sheetName].forEach(function (row) {
      if (isDone_(row[COL.DONE])) return;
      var sec = String(row[COL.SECRETARIAT] == null ? '' : row[COL.SECRETARIAT]).trim();
      if (!sec) return;
      var t = asDate(row[COL.TIMESTAMP]);
      if (!t) return;
      var hrs = (now - t.getTime()) / 3600000;
      var b = bucket(sec);
      if (hrs > b.oldestPendingHours) b.oldestPendingHours = hrs;
    });
  });

  return Object.keys(perSec).sort().map(function (k) {
    var b = perSec[k];
    var avg = b._lat.length
      ? Math.round(b._lat.reduce(function (x, y) { return x + y; }, 0) / b._lat.length)
      : null;
    return {
      secretary: b.secretary, done: b.done, sent: b.sent, untick: b.untick,
      avgMinutes: avg, oldestPendingHours: Math.round(b.oldestPendingHours * 10) / 10
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dateInTz_: dateInTz_, aggregateSummary_: aggregateSummary_ };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/summary.test.js`
Expected: `summary.test.js OK`

- [ ] **Step 5: Commit**

```bash
git add Summary.js tests/summary.test.js
git commit -m "test: aggregateSummary_ per-secretary daily rollup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

