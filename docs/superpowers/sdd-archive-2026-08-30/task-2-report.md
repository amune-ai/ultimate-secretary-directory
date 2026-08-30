# Task 2 Report: Config constants, column expansion, setup_()

## Edits Made

### Step 1: Constants Added to Code.js
Inserted the following constants immediately after `var SPREADSHEET_ID = '1siA7v8Ib3tWyI-GNUHr-baUK2o61qQtZVWxsHcZBShA';` (line 32):

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

### Step 2: COL Map and SHEET_COLUMN_COUNT Expanded
**Before (lines 60–72):**
```js
var COL = {
  TIMESTAMP: 0, // A
  ID: 2,        // C
  SUMMARY: 3,   // D
  CODE: 4,      // E
  PDF: 5,       // F
  NAME: 6,      // G
  CENTER: 7,    // H
  SECRETARIAT: 8, // I
  DONE: 9,      // J
  SENT: 10      // K
};
var SHEET_COLUMN_COUNT = 11; // A:K
```

**After:**
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

### Step 3: Setup.js Created
File `/home/amune/ultimate-secretary-directory/Setup.js` created with idempotent `setup_()` function that:
- Iterates over all `TABS_CONFIG` sheets
- Adds headers `DoneAt`, `DoneBy`, `SentAt`, `SentBy` to columns L–O (1-based 12–15)
- Only writes when the target cell is empty (idempotent guard: `String(cell.getValue()).trim() === ''`)
- Logs each action via `Logger.log()`

## Validation Results

### node --check
- **Code.js**: ✓ PASS (no output)
- **Setup.js**: ✓ PASS (no output)

### clasp push -f
```
Pushed 4 files at 5:25:01 AM.
└─ appsscript.json
└─ Code.js
└─ Index.html
└─ Setup.js
```

Successfully deployed to Apps Script project.

## Files Changed
- **Modified:** `/home/amune/ultimate-secretary-directory/Code.js`
- **Created:** `/home/amune/ultimate-secretary-directory/Setup.js`

## Commit
- **Short SHA:** `a6bc6aa`
- **Subject:** `feat: auth/logging config constants, L-O tracking columns, setup_()`
- **Co-Author:** Claude Sonnet 5 <noreply@anthropic.com>

## Verification Checklist
- [x] Constants placed immediately after `var SPREADSHEET_ID = ...;`
- [x] All exact constant values match brief (ADMIN_USERNAME='a1', SESSION_TTL_MS=8*60*60*1000=28800000, etc.)
- [x] COL block replaced wholesale with 15-key version (A–O)
- [x] SHEET_COLUMN_COUNT = 15
- [x] Setup.js setup_() matches brief exactly, idempotent (only writes on empty cells)
- [x] node --check clean on both files
- [x] clasp push -f succeeded
- [x] No stray edits elsewhere in Code.js (only constants and COL block modified)

## Concerns
None. All edits match the brief exactly, syntax validation passes, and clasp deployment succeeded.

## Next Steps
- User can run `setup_()` manually from the Apps Script editor when ready
- Function will add missing headers to L–O columns on each data tab
- Most operations expected to be no-ops since user pre-created columns
