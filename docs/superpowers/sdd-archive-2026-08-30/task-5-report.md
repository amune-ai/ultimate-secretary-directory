# Task 5 Report: Scoped data read + bootstrap endpoint

## Status: DONE_WITH_CONCERNS

Concern is cosmetic only (clasp reported "Pushed 5 files" vs brief's "Pushed 6") — see Concerns.

---

## TDD Evidence

### RED

Command:
```
node tests/shape.test.js
```
Output:
```
/home/amune/ultimate-secretary-directory/tests/shape.test.js:28
let out = shapeSheetValues_(values, null);
          ^
TypeError: shapeSheetValues_ is not a function
    at Object.<anonymous> (/home/amune/ultimate-secretary-directory/tests/shape.test.js:28:11)
    ...
Node.js v22.23.1
EXIT: 1
```
Why it failed: `Code.js` had no `module.exports`, so `require('../Code.js')` returned `{}` and `shapeSheetValues_` was `undefined`. The pure function also did not exist yet (logic was inline in `getSheetRows_`).

### GREEN

Command:
```
node --check Code.js && echo "CHECK OK" && node tests/shape.test.js; node tests/auth.test.js
```
Output:
```
CHECK OK
shape.test.js OK
shape exit 0
auth.test.js OK
auth exit 0
NO getAllTabsData_ / tabsDataJson refs
```

---

## Code.js edits (3a–3e)

### 3a. `doGet` — dropped inlined sheet data

Before:
```js
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.tabsConfigJson = JSON.stringify(TABS_CONFIG);
  template.columnHeadersJson = JSON.stringify(COLUMN_HEADERS);
  // Escape "<" so a cell containing "</script>" can't break out of the
  // inline <script> block in Index.html. "<" still parses as "<".
  template.tabsDataJson = JSON.stringify(getAllTabsData_()).replace(/</g, '\\u003c');
  return template.evaluate()
    .setTitle('Uploads Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```
After:
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

### 3b. `getAllTabsData_` — deleted

Before (removed entirely):
```js
function getAllTabsData_() {
  var ss = getSpreadsheet_();
  var result = {};
  TABS_CONFIG.forEach(function (tab) {
    result[tab.sheetName] = getSheetRows_(ss, tab.sheetName);
  });
  return result;
}
```
After: gone. `grep -n "getAllTabsData_" Code.js` returns nothing. No remaining callers (old callers were `doGet` and `refreshTabsData`, both rewritten).

### 3c. `refreshTabsData` — token-gated + scoped; added `readAllTabs_` + `getBootstrapData`

Before:
```js
// Public entry point the client calls (via google.script.run) to re-pull
// fresh data from the sheet without reloading the whole page. Apps Script
// won't let client code call a function whose name ends in "_", which is
// why getAllTabsData_() itself can't be called directly from Index.html.
function refreshTabsData() {
  return getAllTabsData_();
}
```
After:
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

### 3d. `getSheetRows_` — split into pure `shapeSheetValues_` + thin wrapper

Before: single `getSheetRows_(ss, sheetName)` with inline map/filter/sort/map and no scope, no `code` field on rowObj.

After:
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

### 3e. Export guard at end of `Code.js`

Added:
```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shapeSheetValues_: shapeSheetValues_ };
}
```
`require('./Code.js')` in Node does not throw — all top-level constants are plain `var`s and the Apps-Script-only functions are just declarations (not invoked at load).

---

## Verification

| Check | Result |
|---|---|
| `node --check Code.js` | `CHECK OK` |
| `node tests/shape.test.js` | `shape.test.js OK` (exit 0) |
| `node tests/auth.test.js` | `auth.test.js OK` (exit 0) |
| `grep getAllTabsData_ Code.js` | no matches (fully removed) |
| `grep tabsDataJson Code.js` | no matches |
| `Auth.js` / `Setup.js` / `Index.html` edited? | No |

### `clasp push -f` output

```
Pushed 5 files at 5:35:26 AM.
└─ appsscript.json
└─ Auth.js
└─ Code.js
└─ Index.html
└─ Setup.js
EXIT 0
```
`tests/` is excluded (`.claspignore` has `tests/**`, `**/*.md`, `docs/**`). Only the 5 real source files in the repo were pushed.

---

## Files changed

- `Code.js` — 3a–3e edits above (89 lines changed: +45 / -44 net per git; commit shows 89 changed)
- `tests/shape.test.js` — new, created verbatim from brief Step 1 (48 lines)

## Commit

`44bf303` — `feat: token-gated, secretary-scoped bootstrap/refresh endpoints`
Trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
Branch: `login-accountability`

---

## Concerns

1. **`clasp push` reported "Pushed 5 files", brief expected "Pushed 6 files."** The repo only contains 5 Apps Script source files (`appsscript.json`, `Auth.js`, `Code.js`, `Index.html`, `Setup.js`). The 6th file the brief anticipated (likely a `Login.html`) is presumably added by a later task. No test file leaked into the push. Not a functional problem.
2. **`doGet` no longer HTML-escapes anything** because it no longer inlines cell data — the `<` escape went away with `tabsDataJson`. Expected per brief. `tabsConfigJson` / `columnHeadersJson` are developer-controlled constants, not user data.
3. **`@HEAD` web app will throw a client JS error** until Index.html is rewired (later task). Expected and documented in the brief.
4. **`refreshTabsData` signature changed** from no-arg to `(token)`. Index.html still calls it with no arg — intentional, rewired later.
