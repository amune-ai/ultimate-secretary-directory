## Task 2: Config constants, column expansion, setup_()

**Files:**
- Modify: `Code.js` (the `SPREADSHEET_ID`/`TABS_CONFIG`/`COL`/`SHEET_COLUMN_COUNT` block near the top)
- Create: `Setup.js`

**Interfaces:**
- Consumes: `getSpreadsheet_`, `TABS_CONFIG`, `COL` from `Code.js`.
- Produces:
  - Constants in `Code.js`: `ADMIN_USERNAME='a1'`, `LOGIN_SHEET='Login'`, `ACTIVITY_SHEET='ActivityLog'`, `SESSION_TTL_MS=28800000`, `SESSION_PREFIX='sess_'`, `LOCKOUT_MAX=5`, `LOCKOUT_WINDOW_S=900`.
  - `COL` extended with `DONE_AT:11, DONE_BY:12, SENT_AT:13, SENT_BY:14`; `SHEET_COLUMN_COUNT=15`.
  - `setup_()` in `Setup.js` — idempotent, adds any missing L–O header on each data tab.

- [ ] **Step 1: Add constants to `Code.js`**

Immediately after the `var SPREADSHEET_ID = '...';` line, add:

```js
// Username that receives the admin view. Every other Login-tab row is a secretary.
var ADMIN_USERNAME = 'a1';

var LOGIN_SHEET = 'Login';
var ACTIVITY_SHEET = 'ActivityLog';

// Sessions: random token -> JSON in Script Properties, key = SESSION_PREFIX + token.
var SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours, extended on each authed call
var SESSION_PREFIX = 'sess_';

// Login brute-force lockout, tracked per username in CacheService.
var LOCKOUT_MAX = 5;        // wrong attempts before the username is blocked
var LOCKOUT_WINDOW_S = 900; // block duration, seconds (15 min)
```

- [ ] **Step 2: Extend `COL` and `SHEET_COLUMN_COUNT` in `Code.js`**

Replace the `var COL = { ... };` and `var SHEET_COLUMN_COUNT = 11;` lines with:

```js
var COL = {
  TIMESTAMP: 0, // A
  ID: 2,        // C
  SUMMARY: 3,   // D
  CODE: 4,      // E  (stable row key)
  PDF: 5,       // F
  NAME: 6,      // G
  CENTER: 7,    // H
  SECRETARIAT: 8, // I
  DONE: 9,      // J
  SENT: 10,     // K
  DONE_AT: 11,  // L
  DONE_BY: 12,  // M
  SENT_AT: 13,  // N
  SENT_BY: 14   // O
};
var SHEET_COLUMN_COUNT = 15; // A:O
```

- [ ] **Step 3: Create `Setup.js` with `setup_()`**

```js
/**
 * One-time / idempotent setup. Adds the four tracking-column headers
 * (DoneAt, DoneBy, SentAt, SentBy = columns L..O) to every data tab if
 * they are not already present. Never touches existing data. Safe to
 * re-run. Run manually from the Apps Script editor after deploying.
 */
function setup_() {
  var ss = getSpreadsheet_();
  var headers = ['DoneAt', 'DoneBy', 'SentAt', 'SentBy']; // L, M, N, O
  TABS_CONFIG.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.sheetName);
    if (!sheet) { Logger.log('setup_: missing data sheet ' + tab.sheetName); return; }
    for (var i = 0; i < headers.length; i++) {
      var col = COL.DONE_AT + 1 + i; // 12..15 (1-based)
      var cell = sheet.getRange(1, col);
      if (String(cell.getValue()).trim() === '') {
        cell.setValue(headers[i]);
        Logger.log('setup_: added header ' + headers[i] + ' to ' + tab.sheetName);
      }
    }
  });
  Logger.log('setup_: done');
}
```

- [ ] **Step 4: Push and run setup_()**

Run: `clasp push -f`
Then in the Apps Script editor: select function `setup_`, Run, authorize if prompted.
Expected (Execution log): `setup_: done`, and each data tab now has `DoneAt`/`DoneBy`/`SentAt`/`SentBy` in row 1 columns L–O (the user pre-created `ActivityLog` and these columns, so most lines are skipped silently — that is correct).

- [ ] **Step 5: Commit**

```bash
git add Code.js Setup.js
git commit -m "feat: auth/logging config constants, L-O tracking columns, setup_()

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

