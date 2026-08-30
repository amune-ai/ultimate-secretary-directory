## Task 5: Scoped data read + bootstrap endpoint

**Files:**
- Modify: `Code.js` (`doGet`, `getSheetRows_`, remove `getAllTabsData_`, add `shapeSheetValues_`, `readAllTabs_`, `getBootstrapData`, rewrite `refreshTabsData`)
- Create: `tests/shape.test.js`

**Interfaces:**
- Consumes: `requireSession_` (Task 4); `COL`, `SHEET_COLUMN_COUNT`, `TABS_CONFIG`, `timestampValue_`, `isDone_`, `isSent_`, `formatTimestamp_` (`Code.js`).
- Produces:
  - `shapeSheetValues_(values, scope) -> [rowObj]` (pure). `values` is the raw 2D array of `A2:O`. `scope` is a secretary name string or `null`/falsy for "all". `rowObj = {sheetRow:number, code:string, done:boolean, sent:boolean, cells:[timestamp, name, id, center, summary, secretariat, code, pdf]}`. Rows all-empty are dropped; when `scope` set, only rows whose `COL.SECRETARIAT` trims-equal `scope` are kept; sorted newest-first by `COL.TIMESTAMP`.
  - `getSheetRows_(ss, sheetName, scope) -> [rowObj]` — thin wrapper over `shapeSheetValues_`.
  - `readAllTabs_(scope) -> { sheetName: [rowObj] }`.
  - `getBootstrapData(token) -> { tabsData:{...}, name:string, role:string }` — `requireSession_`, secretaries scoped to their name, admin unscoped.
  - `refreshTabsData(token) -> { sheetName: [rowObj] }` — same scoping, for the refresh button.
  - `doGet` no longer embeds `tabsDataJson`; still passes `tabsConfigJson` and `columnHeadersJson`.

- [ ] **Step 1: Write the failing test — `tests/shape.test.js`**

```js
const assert = require('node:assert');
const { shapeSheetValues_ } = require('../Code.js');

// Build an A:O row (15 cols). Only the columns shapeSheetValues_ reads matter.
function row(opts) {
  const r = new Array(15).fill('');
  r[0]  = opts.ts   || '';   // A timestamp
  r[2]  = opts.id   || '';   // C id
  r[3]  = opts.sum  || '';   // D summary
  r[4]  = opts.code || '';   // E code
  r[5]  = opts.pdf  || '';   // F pdf
  r[6]  = opts.name || '';   // G name
  r[7]  = opts.ctr  || '';   // H center
  r[8]  = opts.sec  || '';   // I secretariat
  r[9]  = opts.done || '';   // J done
  r[10] = opts.sent || '';   // K sent
  return r;
}

const values = [
  row({ ts: '2026-08-01 09:00:00', code: 'C-1', sec: 'حصة الردهان', name: 'A', done: 'Done' }),
  row({ ts: '2026-08-03 09:00:00', code: 'C-2', sec: 'وضحة الحجرف', name: 'B' }),
  row({ ts: '2026-08-02 09:00:00', code: 'C-3', sec: 'حصة الردهان', name: 'C', sent: 'Sent', done: 'Done' }),
  new Array(15).fill(''), // all-empty, must be dropped
];

// unscoped: 3 rows, newest first
let out = shapeSheetValues_(values, null);
assert.strictEqual(out.length, 3);
assert.deepStrictEqual(out.map(r => r.code), ['C-2', 'C-3', 'C-1']);
assert.strictEqual(out[1].done, true);
assert.strictEqual(out[1].sent, true);
assert.strictEqual(out[2].done, true);
assert.strictEqual(out[0].done, false);
// cells order: [timestamp, name, id, center, summary, secretariat, code, pdf]
assert.strictEqual(out[0].cells[1], 'B');
assert.strictEqual(out[0].cells[5], 'وضحة الحجرف');
assert.strictEqual(out[0].cells[6], 'C-2');

// scoped to حصة الردهان: 2 rows, newest first, other secretary excluded
out = shapeSheetValues_(values, 'حصة الردهان');
assert.deepStrictEqual(out.map(r => r.code), ['C-3', 'C-1']);

// scope trims whitespace on both sides
out = shapeSheetValues_(values, '  حصة الردهان ');
assert.strictEqual(out.length, 2);

console.log('shape.test.js OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/shape.test.js`
Expected: FAIL — `shapeSheetValues_ is not a function` (or module has no export yet).

- [ ] **Step 3: Edit `Code.js`**

3a. Replace the body of `doGet` with:

```js
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.tabsConfigJson = JSON.stringify(TABS_CONFIG);
  template.columnHeadersJson = JSON.stringify(COLUMN_HEADERS);
  return template.evaluate()
    .setTitle('Uploads Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

3b. Delete the `getAllTabsData_` function entirely.

3c. Replace `refreshTabsData` with:

```js
// Called by the client refresh button. Token-gated; scoped for secretaries.
function refreshTabsData(token) {
  var session = requireSession_(token);
  return readAllTabs_(session.role === 'admin' ? null : session.name);
}

function readAllTabs_(scope) {
  var ss = getSpreadsheet_();
  var out = {};
  TABS_CONFIG.forEach(function (tab) {
    out[tab.sheetName] = getSheetRows_(ss, tab.sheetName, scope);
  });
  return out;
}

// requireSession_ + scope, for first paint after login.
function getBootstrapData(token) {
  var session = requireSession_(token);
  return {
    tabsData: readAllTabs_(session.role === 'admin' ? null : session.name),
    name: session.name,
    role: session.role
  };
}
```

3d. Replace `getSheetRows_` with the pure-core + wrapper pair:

```js
// Pure: raw A2:O values -> display rows. scope = secretary name or falsy.
function shapeSheetValues_(values, scope) {
  var wantScope = scope ? String(scope).trim() : '';
  return values
    .map(function (row, i) { return { row: row, sheetRow: i + 2 }; })
    .filter(function (item) {
      return item.row.some(function (cell) { return cell !== '' && cell !== null; });
    })
    .filter(function (item) {
      return !wantScope || String(item.row[COL.SECRETARIAT]).trim() === wantScope;
    })
    .sort(function (a, b) {
      return timestampValue_(b.row[COL.TIMESTAMP]) - timestampValue_(a.row[COL.TIMESTAMP]);
    })
    .map(function (item) {
      var row = item.row;
      return {
        sheetRow: item.sheetRow,
        code: String(row[COL.CODE] || ''),
        done: isDone_(row[COL.DONE]),
        sent: isSent_(row[COL.SENT]),
        cells: [
          formatTimestamp_(row[COL.TIMESTAMP]),
          row[COL.NAME] || '',
          row[COL.ID] || '',
          row[COL.CENTER] || '',
          row[COL.SUMMARY] || '',
          row[COL.SECRETARIAT] || '',
          row[COL.CODE] || '',
          row[COL.PDF] || ''
        ]
      };
    });
}

function getSheetRows_(ss, sheetName, scope) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT).getValues();
  return shapeSheetValues_(values, scope);
}
```

3e. At the very end of `Code.js` add:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shapeSheetValues_: shapeSheetValues_ };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/shape.test.js`
Expected: `shape.test.js OK`
Also re-run: `node tests/auth.test.js` → still `auth.test.js OK`.

- [ ] **Step 5: Push (client still references old inlined data — that is expected; Index.html is rewired in Task 10–11)**

Run: `clasp push -f`
Expected: `Pushed 6 files.`
Note: the web app `@HEAD` will show a JS error until Task 11 — acceptable, not deployed to prod.

- [ ] **Step 6: Commit**

```bash
git add Code.js tests/shape.test.js
git commit -m "feat: token-gated, secretary-scoped bootstrap/refresh endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

