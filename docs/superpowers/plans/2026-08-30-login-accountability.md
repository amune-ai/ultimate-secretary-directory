# Login + Accountability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add username/password login, per-secretary data scoping, timestamped Done/Sent activity logging, and an admin summary panel to the Uploads Dashboard Apps Script web app.

**Architecture:** Server (Apps Script `.js` files, concatenated into one global scope by clasp) gains a custom auth layer — plaintext-password check against a `Login` sheet, random session tokens persisted in Script Properties, brute-force lockout in CacheService. Every data/write endpoint requires a valid token; secretaries get server-side row filtering by the سكرتارية column, the admin (`a1`) gets everything plus a summary endpoint. Tick writes are located by the immutable `Code` column, stamp four new columns, and append to an `ActivityLog` sheet. The single-file client (`Index.html`) gains a login view, session handling, an inline error banner, and an admin-only summary panel.

**Tech Stack:** Google Apps Script (V8 runtime), `clasp` 3.3.0 for push/deploy, vanilla browser JS + `google.script.run`, Node 22 `node:assert` for local unit tests of pure functions. No frameworks, no bundler, no new dependencies.

## Global Constraints

- Stay on Apps Script + vanilla JS. No framework, no bundler, no database, no npm dependencies.
- Admin username is exactly `a1` (constant `ADMIN_USERNAME` in `Code.js`). Every other `Login` row is a secretary.
- `Login` tab columns, in order: `Username`, `Password`, `Name`. Passwords are plaintext (documented ceiling). `Name` must equal the سكرتارية column value in data sheets.
- `ActivityLog` tab columns, in order: `timestamp`, `sheet`, `rowKey`, `username`, `secretaryName`, `action`, `oldValue`, `newValue`. `rowKey` is the row's `Code` (column E). `action` is `done` or `sent`.
- Data sheets gain columns L–O: `DoneAt`, `DoneBy`, `SentAt`, `SentBy`. `SHEET_COLUMN_COUNT` becomes `15` (A:O).
- Row lookup key for writes is the `Code` column (E), assumed unique across the 3 data tabs. Blank/duplicate/missing `Code` → reject the write.
- Session lifetime 8 hours, sliding (extended on every authenticated call). Lockout: 5 wrong tries per username → 15-minute block.
- Deployment stays `access: ANYONE_ANONYMOUS`, `executeAs: USER_DEPLOYING`. The page loads for anyone; custom auth is the gate; **no sheet data is embedded in the page**.
- Data sheets to operate on come from `TABS_CONFIG`: `UploadedData`, `UploadedVacations`, `UploadedEqrarawdah`.
- Timezone for all date bucketing: `Session.getScriptTimeZone()` (`Asia/Riyadh`).
- Pure functions (no `SpreadsheetApp`/`PropertiesService`/`CacheService`/`Utilities`/`Session` references at call time) get a Node unit test. Apps Script "glue" gets a `runTests_()` assertion where feasible plus a manual checklist step.
- Every server `.js` file that defines pure functions ends with:
  ```js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { /* pure fns used by tests */ };
  }
  ```
  (`typeof module` is `"undefined"` in Apps Script, so this is inert there.)
- During implementation, `clasp push` updates the project and its `@HEAD` test deployment only. The live versioned web app (deployment id `AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O`) is **only** redeployed in the final task.
- Commit after every task with a `feat:`/`chore:`/`test:` message ending:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

---

## File Structure

- `Code.js` (modify) — config constants, `COL`/`SHEET_COLUMN_COUNT`, `doGet`, `getSpreadsheet_`, `assertKnownSheet_`, `shapeSheetValues_` (pure), `getSheetRows_`, `readAllTabs_`, `getBootstrapData`, `refreshTabsData`, `timestampValue_`, `isDone_`, `isSent_`, `formatTimestamp_`. Existing `setRowDone`/`setRowSent` move out.
- `Auth.js` (create) — pure: `normalizeUsername_`, `checkCredentials_`, `sessionValid_`. Glue: session store (`createSession_`, `readSession_`, `touchSession_`, `deleteSession_`, `sweepExpiredSessions_`), lockout (`lockoutCount_`, `bumpLockout_`, `clearLockout_`), `readLoginRows_`, `requireSession_`, and public `login`, `resumeSession`, `logout`.
- `Activity.js` (create) — pure: `findRowByCode_`. Glue: `writeTick_`, public `setRowDone`, `setRowSent`, `appendActivity_`.
- `Summary.js` (create) — pure: `aggregateSummary_`, `dateInTz_`. Glue: `getAdminSummary`.
- `Setup.js` (create) — `setup_()` (idempotent header check), `runTests_()` (in-editor assertions).
- `Index.html` (modify) — login view, session handling, logout, inline banner, role-based filter visibility, `data-code` on rows, scoped tick calls, admin summary panel, "last updated" label, aria-labels.
- `.claspignore` (create) — exclude `docs/**`, `tests/**`, `**/*.md` from `clasp push`.
- `tests/auth.test.js`, `tests/shape.test.js`, `tests/activity.test.js`, `tests/summary.test.js` (create) — Node.
- `bkp.html`, `BKP1Codegs.html` (delete).

---

## Task 1: Repo cleanup and clasp ignore rules

**Files:**
- Delete: `bkp.html`
- Delete: `BKP1Codegs.html`
- Create: `.claspignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a `clasp push` that uploads only real source (`appsscript.json`, `Code.js`, `Index.html`, and later `Auth.js`/`Activity.js`/`Summary.js`/`Setup.js`).

- [ ] **Step 1: Delete the two backup files**

```bash
cd /home/amune/ultimate-secretary-directory
git rm bkp.html BKP1Codegs.html
```

- [ ] **Step 2: Create `.claspignore`**

```
# Local-only; never pushed to Apps Script
docs/**
tests/**
**/*.md
.claspignore
.gitignore
.git/**
node_modules/**
```

- [ ] **Step 3: Verify clasp will push only source**

Run: `clasp status`
Expected: the "Not ignored files" / "tracked" list contains `appsscript.json`, `Code.js`, `Index.html` and **not** `bkp.html`, `BKP1Codegs.html`, anything under `docs/` or `tests/`.

- [ ] **Step 4: Push**

Run: `clasp push -f`
Expected: `Pushed 3 files.` (appsscript.json, Code.js, Index.html)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove backup files, add .claspignore

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

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

## Task 3: Auth pure helpers + Node tests

**Files:**
- Create: `Auth.js` (pure section only)
- Create: `tests/auth.test.js`

**Interfaces:**
- Consumes: `ADMIN_USERNAME` (global; the test sets `global.ADMIN_USERNAME` before `require`).
- Produces:
  - `normalizeUsername_(s) -> string` — trim + lowercase, null-safe.
  - `checkCredentials_(loginRows, username, password) -> {username, name, role} | null` where `loginRows` is `[{username, password, name}]`; `role` is `'admin'` iff normalized username === normalized `ADMIN_USERNAME`; empty password never matches.
  - `sessionValid_(session, nowMs) -> boolean` — true iff `session` truthy and `session.exp` is a number `> nowMs`.

- [ ] **Step 1: Write the failing test — `tests/auth.test.js`**

```js
const assert = require('node:assert');
global.ADMIN_USERNAME = 'a1';
const { normalizeUsername_, checkCredentials_, sessionValid_ } = require('../Auth.js');

const rows = [
  { username: 'a1', password: 'a11', name: 'عبدالرحمن المراقي' },
  { username: 'h1', password: 'h11', name: 'حصة الردهان' },
  { username: 'alajmi5635', password: 'xxxxxxxxx', name: 'وضحة الحجرف' },
];

// normalizeUsername_
assert.strictEqual(normalizeUsername_('  A1 '), 'a1');
assert.strictEqual(normalizeUsername_(null), '');

// checkCredentials_ — admin
let r = checkCredentials_(rows, 'A1', 'a11');
assert.deepStrictEqual(r, { username: 'a1', name: 'عبدالرحمن المراقي', role: 'admin' });

// checkCredentials_ — secretary
r = checkCredentials_(rows, 'h1', 'h11');
assert.strictEqual(r.role, 'secretary');
assert.strictEqual(r.name, 'حصة الردهان');

// wrong password
assert.strictEqual(checkCredentials_(rows, 'h1', 'nope'), null);
// unknown user
assert.strictEqual(checkCredentials_(rows, 'ghost', 'x'), null);
// empty password never matches even if the row's password is empty
assert.strictEqual(checkCredentials_([{ username: 'x', password: '', name: 'X' }], 'x', ''), null);

// sessionValid_
assert.strictEqual(sessionValid_({ exp: 2000 }, 1000), true);
assert.strictEqual(sessionValid_({ exp: 500 }, 1000), false);
assert.strictEqual(sessionValid_(null, 1000), false);
assert.strictEqual(sessionValid_({}, 1000), false);

console.log('auth.test.js OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/auth.test.js`
Expected: FAIL — `Cannot find module '../Auth.js'`.

- [ ] **Step 3: Create `Auth.js` with the pure helpers**

```js
/**
 * Custom auth for the Uploads Dashboard. Plaintext-password check against
 * the Login tab, random session tokens in Script Properties, per-username
 * brute-force lockout in CacheService.
 *
 * ponytail: plaintext passwords in the Login sheet. Fine while the sheet
 * stays with the admin only. Upgrade path: hash-on-entry via an onEdit
 * trigger that salts + SHA-256s the Password cell and blanks it.
 */

function normalizeUsername_(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// loginRows: [{username, password, name}] read verbatim from the Login tab.
// Returns {username, name, role} on an exact match (username case-insensitive,
// password case-sensitive, non-empty), else null.
function checkCredentials_(loginRows, username, password) {
  var u = normalizeUsername_(username);
  var p = String(password == null ? '' : password);
  if (p === '') return null;
  for (var i = 0; i < loginRows.length; i++) {
    var row = loginRows[i];
    if (normalizeUsername_(row.username) === u && String(row.password) === p) {
      return {
        username: u,
        name: String(row.name == null ? '' : row.name).trim(),
        role: (u === normalizeUsername_(ADMIN_USERNAME)) ? 'admin' : 'secretary'
      };
    }
  }
  return null;
}

function sessionValid_(session, nowMs) {
  return !!session && typeof session.exp === 'number' && session.exp > nowMs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeUsername_: normalizeUsername_,
    checkCredentials_: checkCredentials_,
    sessionValid_: sessionValid_
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/auth.test.js`
Expected: `auth.test.js OK`

- [ ] **Step 5: Commit**

```bash
git add Auth.js tests/auth.test.js
git commit -m "test: auth pure helpers (checkCredentials_, sessionValid_)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Auth glue — session store, lockout, login/resume/logout

**Files:**
- Modify: `Auth.js` (append glue section before the `module.exports` block)

**Interfaces:**
- Consumes: pure helpers from Task 3; constants from Task 2; `getSpreadsheet_` from `Code.js`.
- Produces:
  - `readLoginRows_() -> [{username, password, name}]` — reads `Login!A2:C`.
  - `createSession_(user) -> {token, session}` — `user` is `{username, name, role}`; token is two UUIDs concatenated.
  - `readSession_(token) -> session|null`; `touchSession_(token, session)`; `deleteSession_(token)`; `sweepExpiredSessions_()`.
  - `requireSession_(token) -> {username, name, role}` — throws `Error('AUTH')` if invalid/expired; extends expiry on success.
  - `lockoutCount_(username) -> number`; `bumpLockout_(username) -> number`; `clearLockout_(username)`.
  - `login(username, password) -> {ok:true, token, name, role} | {ok:false, error:'bad_credentials'|'locked'}`.
  - `resumeSession(token) -> {ok:true, name, role} | {ok:false}`.
  - `logout(token) -> true`.

- [ ] **Step 1: Append the glue section to `Auth.js`**

Insert **above** the `if (typeof module !== 'undefined' ...)` block:

```js
// ------------------------------------------------------------------
// Glue (Apps Script services). Not unit-tested in Node; exercised by
// runTests_() and the manual checklist.
// ------------------------------------------------------------------

function readLoginRows_() {
  var sheet = getSpreadsheet_().getSheetByName(LOGIN_SHEET);
  if (!sheet) throw new Error('Login sheet missing');
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var vals = sheet.getRange(2, 1, last - 1, 3).getValues(); // Username, Password, Name
  return vals.map(function (r) { return { username: r[0], password: r[1], name: r[2] }; });
}

function sessionKey_(token) { return SESSION_PREFIX + token; }

function createSession_(user) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var session = {
    username: user.username, name: user.name, role: user.role,
    exp: Date.now() + SESSION_TTL_MS
  };
  PropertiesService.getScriptProperties().setProperty(sessionKey_(token), JSON.stringify(session));
  return { token: token, session: session };
}

function readSession_(token) {
  if (!token) return null;
  var raw = PropertiesService.getScriptProperties().getProperty(sessionKey_(token));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function touchSession_(token, session) {
  session.exp = Date.now() + SESSION_TTL_MS;
  PropertiesService.getScriptProperties().setProperty(sessionKey_(token), JSON.stringify(session));
}

function deleteSession_(token) {
  PropertiesService.getScriptProperties().deleteProperty(sessionKey_(token));
}

function sweepExpiredSessions_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(SESSION_PREFIX) !== 0) return;
    var ok = false;
    try { var s = JSON.parse(all[k]); ok = s && typeof s.exp === 'number' && s.exp > now; } catch (e) {}
    if (!ok) props.deleteProperty(k);
  });
}

function requireSession_(token) {
  var session = readSession_(token);
  if (!sessionValid_(session, Date.now())) throw new Error('AUTH');
  touchSession_(token, session);
  return session;
}

function lockKey_(username) { return 'lock_' + normalizeUsername_(username); }

function lockoutCount_(username) {
  var v = CacheService.getScriptCache().get(lockKey_(username));
  return v ? parseInt(v, 10) : 0;
}

function bumpLockout_(username) {
  var n = lockoutCount_(username) + 1;
  CacheService.getScriptCache().put(lockKey_(username), String(n), LOCKOUT_WINDOW_S);
  return n;
}

function clearLockout_(username) {
  CacheService.getScriptCache().remove(lockKey_(username));
}

// ---- public entry points (called via google.script.run) ----

function login(username, password) {
  if (lockoutCount_(username) >= LOCKOUT_MAX) return { ok: false, error: 'locked' };
  var user = checkCredentials_(readLoginRows_(), username, password);
  if (!user) {
    var n = bumpLockout_(username);
    return { ok: false, error: (n >= LOCKOUT_MAX) ? 'locked' : 'bad_credentials' };
  }
  clearLockout_(username);
  sweepExpiredSessions_();
  var created = createSession_(user);
  return { ok: true, token: created.token, name: user.name, role: user.role };
}

function resumeSession(token) {
  var session = readSession_(token);
  if (!sessionValid_(session, Date.now())) return { ok: false };
  touchSession_(token, session);
  return { ok: true, name: session.name, role: session.role };
}

function logout(token) {
  deleteSession_(token);
  return true;
}
```

- [ ] **Step 2: Create `runTests_()` in `Setup.js` with a session round-trip assertion**

Append to `Setup.js`:

```js
/**
 * In-editor test runner. Select runTests_ in the Apps Script editor and
 * Run; check the Execution log for "runTests_: ALL PASS" or a thrown
 * assertion. Re-run after any server change.
 */
function runTests_() {
  function eq(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error('FAIL ' + msg + ' -> got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
    }
  }
  function truthy(v, msg) { if (!v) throw new Error('FAIL ' + msg); }
  function throws(fn, msg) {
    var t = false; try { fn(); } catch (e) { t = true; }
    if (!t) throw new Error('FAIL (expected throw) ' + msg);
  }

  // --- checkCredentials_ ---
  var rows = [
    { username: 'a1', password: 'a11', name: 'Admin Name' },
    { username: 'h1', password: 'h11', name: 'حصة الردهان' }
  ];
  eq(checkCredentials_(rows, 'A1', 'a11').role, 'admin', 'cc admin role');
  eq(checkCredentials_(rows, 'h1', 'h11').role, 'secretary', 'cc secretary role');
  eq(checkCredentials_(rows, 'h1', 'bad'), null, 'cc wrong pw');

  // --- session round-trip via Script Properties ---
  var made = createSession_({ username: 'h1', name: 'حصة الردهان', role: 'secretary' });
  truthy(made.token && made.token.length > 30, 'session token generated');
  var got = requireSession_(made.token);
  eq(got.username, 'h1', 'requireSession_ returns session');
  logout(made.token);
  throws(function () { requireSession_(made.token); }, 'requireSession_ after logout throws');

  // --- expired session ---
  var expired = { username: 'x', name: 'x', role: 'secretary', exp: Date.now() - 1000 };
  PropertiesService.getScriptProperties().setProperty(SESSION_PREFIX + 'TESTEXP', JSON.stringify(expired));
  throws(function () { requireSession_('TESTEXP'); }, 'expired session throws');
  PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX + 'TESTEXP');

  Logger.log('runTests_: ALL PASS');
}
```

- [ ] **Step 3: Push and run runTests_()**

Run: `clasp push -f`
Then in the Apps Script editor: run `runTests_`.
Expected (Execution log): `runTests_: ALL PASS`.

- [ ] **Step 4: Manual — real login round-trip**

In the editor, run this throwaway snippet (paste as a temp function, run, then delete it):

```js
function _tmpLogin() {
  Logger.log(login('h1', 'h11'));      // expect ok:true, role secretary
  Logger.log(login('h1', 'wrong'));    // expect ok:false, bad_credentials
}
```

Expected log: first line `{ok=true, token=..., name=حصة الردهان, role=secretary}`; second `{ok=false, error=bad_credentials}`. Delete `_tmpLogin` after.

- [ ] **Step 5: Commit**

```bash
git add Auth.js Setup.js
git commit -m "feat: session store, lockout, login/resume/logout endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

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

## Task 6: Row lookup by Code — pure + Node tests

**Files:**
- Create: `Activity.js` (pure section only)
- Create: `tests/activity.test.js`

**Interfaces:**
- Consumes: `COL` (global; test sets `global.COL`).
- Produces:
  - `findRowByCode_(values, code, rowHint) -> {index0:number, sheetRow:number}`. `values` is the raw `A2:O` 2D array. Matches on `COL.CODE` trimmed-equal to `code` trimmed. Exactly one match → return it. Zero → `throw Error('NOT_FOUND')`. Blank `code` → `throw Error('NO_CODE')`. Multiple matches → if `rowHint` (1-based sheet row) points at one of them, return that; else `throw Error('AMBIGUOUS')`.

- [ ] **Step 1: Write the failing test — `tests/activity.test.js`**

```js
const assert = require('node:assert');
global.COL = { CODE: 4 };
const { findRowByCode_ } = require('../Activity.js');

function rowWithCode(c) { const r = new Array(15).fill(''); r[4] = c; return r; }
const values = [rowWithCode('C-1'), rowWithCode('C-2'), rowWithCode('C-3')];

assert.deepStrictEqual(findRowByCode_(values, 'C-2', 3), { index0: 1, sheetRow: 3 });
assert.deepStrictEqual(findRowByCode_(values, ' C-3 ', null), { index0: 2, sheetRow: 4 });

assert.throws(() => findRowByCode_(values, 'C-9', null), /NOT_FOUND/);
assert.throws(() => findRowByCode_(values, '', null), /NO_CODE/);
assert.throws(() => findRowByCode_(values, '   ', null), /NO_CODE/);

// duplicate code -> hint resolves, otherwise AMBIGUOUS
const dup = [rowWithCode('D'), rowWithCode('D'), rowWithCode('X')];
assert.deepStrictEqual(findRowByCode_(dup, 'D', 3), { index0: 1, sheetRow: 3 }); // hint = sheetRow 3 -> index0 1
assert.throws(() => findRowByCode_(dup, 'D', null), /AMBIGUOUS/);
assert.throws(() => findRowByCode_(dup, 'D', 99), /AMBIGUOUS/);

console.log('activity.test.js OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/activity.test.js`
Expected: FAIL — `Cannot find module '../Activity.js'`.

- [ ] **Step 3: Create `Activity.js` pure section**

```js
/**
 * Done / أنجاز(Sent) tick writes. Locates the target row by its immutable
 * Code (column E) rather than a row number, stamps DoneAt/DoneBy or
 * SentAt/SentBy, and appends an ActivityLog row.
 */

// values: raw A2:O 2D array. rowHint: 1-based sheet row from the client, used
// only to disambiguate a duplicate Code. Returns {index0, sheetRow}.
function findRowByCode_(values, code, rowHint) {
  var wanted = String(code == null ? '' : code).trim();
  if (wanted === '') throw new Error('NO_CODE');

  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][COL.CODE]).trim() === wanted) matches.push(i);
  }
  if (matches.length === 1) return { index0: matches[0], sheetRow: matches[0] + 2 };
  if (matches.length === 0) throw new Error('NOT_FOUND');

  var hintIdx0 = Number(rowHint) - 2;
  if (matches.indexOf(hintIdx0) !== -1) return { index0: hintIdx0, sheetRow: hintIdx0 + 2 };
  throw new Error('AMBIGUOUS');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findRowByCode_: findRowByCode_ };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/activity.test.js`
Expected: `activity.test.js OK`

- [ ] **Step 5: Commit**

```bash
git add Activity.js tests/activity.test.js
git commit -m "test: findRowByCode_ row lookup by Code column

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Tick write glue — setRowDone / setRowSent / activity log

**Files:**
- Modify: `Activity.js` (append glue before `module.exports`)
- Modify: `Setup.js` (`runTests_()` — add pure-logic assertions for the ownership/order rules by extracting them into a testable helper)

**Interfaces:**
- Consumes: `findRowByCode_` (Task 6); `requireSession_` (Task 4); `assertKnownSheet_`, `getSpreadsheet_`, `COL`, `SHEET_COLUMN_COUNT`, `isDone_`, `isSent_` (`Code.js`); `ACTIVITY_SHEET` (Task 2).
- Produces:
  - `tickGuard_(session, row, action, value) -> void` (pure) — throws `Error('NOT_YOUR_ROW')` if `session.role !== 'admin'` and `row[COL.SECRETARIAT]` trimmed ≠ `session.name` trimmed; throws `Error('DONE_FIRST')` if `action==='sent' && value && !isDone_(row[COL.DONE])`.
  - `writeTick_(token, sheetName, code, rowHint, action, value) -> {code:string, done:boolean, sent:boolean}`.
  - `setRowDone(token, sheetName, code, rowHint, done) -> {code, done, sent}`.
  - `setRowSent(token, sheetName, code, rowHint, sent) -> {code, done, sent}`.
  - `appendActivity_(sheetName, code, session, action, oldValue, newValue) -> void` — appends `[new Date(), sheetName, code, session.username, session.name, action, oldValue, newValue]` to `ActivityLog`.

- [ ] **Step 1: Add pure `tickGuard_` assertions to `tests/activity.test.js`**

Append:

```js
global.isDone_ = v => String(v || '').trim().toLowerCase() === 'done';
const { tickGuard_ } = require('../Activity.js');

const secRow = new Array(15).fill('');
secRow[8] = 'حصة الردهان';   // I secretariat
secRow[9] = '';               // J done (blank)

const adminS = { role: 'admin', name: 'Someone', username: 'a1' };
const hessa  = { role: 'secretary', name: 'حصة الردهان', username: 'h1' };
const wadha  = { role: 'secretary', name: 'وضحة الحجرف', username: 'w1' };

// admin can do anything
assert.doesNotThrow(() => tickGuard_(adminS, secRow, 'done', true));
// owner ok
assert.doesNotThrow(() => tickGuard_(hessa, secRow, 'done', true));
// non-owner blocked
assert.throws(() => tickGuard_(wadha, secRow, 'done', true), /NOT_YOUR_ROW/);
// sent before done blocked
assert.throws(() => tickGuard_(hessa, secRow, 'sent', true), /DONE_FIRST/);
// sent allowed once done
const doneRow = secRow.slice(); doneRow[9] = 'Done';
assert.doesNotThrow(() => tickGuard_(hessa, doneRow, 'sent', true));
// un-ticking sent is never blocked by order
assert.doesNotThrow(() => tickGuard_(hessa, secRow, 'sent', false));

console.log('activity.test.js guard OK');
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/activity.test.js`
Expected: FAIL — `tickGuard_ is not a function`.

- [ ] **Step 3: Append glue to `Activity.js`** (before the `module.exports` block, and add `tickGuard_` to the exports)

```js
// Pure guard: ownership + Done-before-Sent ordering.
function tickGuard_(session, row, action, value) {
  if (session.role !== 'admin' &&
      String(row[COL.SECRETARIAT]).trim() !== String(session.name).trim()) {
    throw new Error('NOT_YOUR_ROW');
  }
  if (action === 'sent' && value && !isDone_(row[COL.DONE])) {
    throw new Error('DONE_FIRST');
  }
}

function appendActivity_(sheetName, code, session, action, oldValue, newValue) {
  var sheet = getSpreadsheet_().getSheetByName(ACTIVITY_SHEET);
  if (!sheet) throw new Error('ActivityLog sheet missing');
  sheet.appendRow([
    new Date(), sheetName, String(code), session.username, session.name,
    action, String(oldValue), String(newValue)
  ]);
}

function writeTick_(token, sheetName, code, rowHint, action, value) {
  var session = requireSession_(token);
  assertKnownSheet_(sheetName);

  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('NOT_FOUND');

  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_COLUMN_COUNT).getValues();
  var loc = findRowByCode_(values, code, rowHint);
  var row = values[loc.index0];

  tickGuard_(session, row, action, value);

  var valueCol = (action === 'done') ? COL.DONE : COL.SENT;
  var atCol    = (action === 'done') ? COL.DONE_AT : COL.SENT_AT;
  var byCol    = (action === 'done') ? COL.DONE_BY : COL.SENT_BY;
  var word     = (action === 'done') ? 'Done' : 'Sent';

  var oldValue = String(row[valueCol] || '');
  var newValue = value ? word : '';

  sheet.getRange(loc.sheetRow, valueCol + 1).setValue(newValue);
  sheet.getRange(loc.sheetRow, atCol + 1).setValue(value ? new Date() : '');
  sheet.getRange(loc.sheetRow, byCol + 1).setValue(value ? session.username : '');

  appendActivity_(sheetName, String(code).trim(), session, action, oldValue, newValue);

  var doneNow = (action === 'done') ? !!value : isDone_(row[COL.DONE]);
  var sentNow = (action === 'sent') ? !!value : isSent_(row[COL.SENT]);
  return { code: String(code).trim(), done: doneNow, sent: sentNow };
}

function setRowDone(token, sheetName, code, rowHint, done) {
  return writeTick_(token, sheetName, code, rowHint, 'done', !!done);
}

function setRowSent(token, sheetName, code, rowHint, sent) {
  return writeTick_(token, sheetName, code, rowHint, 'sent', !!sent);
}
```

Update the export block at the bottom of `Activity.js` to:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findRowByCode_: findRowByCode_, tickGuard_: tickGuard_ };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/activity.test.js`
Expected: both `activity.test.js OK` and `activity.test.js guard OK`.

- [ ] **Step 5: Push and smoke-test a real write**

Run: `clasp push -f`
Then paste, run, and delete this temp function in the editor (replace `<CODE>` with a real `Code` value from `UploadedData`, `<SEC>` with that row's سكرتارية):

```js
function _tmpTick() {
  var s = login('a1', 'a11');                 // admin, bypasses ownership
  Logger.log(setRowDone(s.token, 'UploadedData', '<CODE>', 0, true));
  Logger.log(setRowDone(s.token, 'UploadedData', '<CODE>', 0, false)); // undo
  logout(s.token);
}
```

Expected: first log `{code=<CODE>, done=true, sent=false}`; the `UploadedData` row shows `Done` in J, a timestamp in L, `a1` in M, then all cleared; `ActivityLog` gains two rows (`done` set then un-set). Delete `_tmpTick`.

- [ ] **Step 6: Commit**

```bash
git add Activity.js tests/activity.test.js
git commit -m "feat: setRowDone/setRowSent with ownership, ordering, activity log

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

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

## Task 9: Admin summary endpoint

**Files:**
- Modify: `Summary.js` (append `getAdminSummary` before `module.exports`)

**Interfaces:**
- Consumes: `aggregateSummary_` (Task 8); `requireSession_` (Task 4); `getSpreadsheet_`, `TABS_CONFIG`, `SHEET_COLUMN_COUNT` (`Code.js`); `ACTIVITY_SHEET` (Task 2).
- Produces:
  - `getAdminSummary(token, dateStr) -> { date:string, rows:[...] }`. `requireSession_`; throws `Error('AUTH')` if role ≠ admin. `dateStr` optional — defaults to today in script timezone.

- [ ] **Step 1: Append `getAdminSummary` to `Summary.js`**

```js
// Called via google.script.run by the admin view. dateStr 'yyyy-MM-dd' or ''.
function getAdminSummary(token, dateStr) {
  var session = requireSession_(token);
  if (session.role !== 'admin') throw new Error('AUTH');

  var tz = Session.getScriptTimeZone();
  if (!dateStr) dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var ss = getSpreadsheet_();

  var logSheet = ss.getSheetByName(ACTIVITY_SHEET);
  var logRows = (logSheet && logSheet.getLastRow() > 1)
    ? logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues()
    : [];

  var dataRowsBySheet = {};
  TABS_CONFIG.forEach(function (tab) {
    var sheet = ss.getSheetByName(tab.sheetName);
    dataRowsBySheet[tab.sheetName] = (sheet && sheet.getLastRow() > 1)
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, SHEET_COLUMN_COUNT).getValues()
      : [];
  });

  return { date: dateStr, rows: aggregateSummary_(logRows, dataRowsBySheet, dateStr, tz) };
}
```

- [ ] **Step 2: Push and smoke-test**

Run: `clasp push -f`
Paste/run/delete in the editor:

```js
function _tmpSummary() {
  var s = login('a1', 'a11');
  Logger.log(JSON.stringify(getAdminSummary(s.token, ''), null, 2));
  var sec = login('h1', 'h11');
  try { getAdminSummary(sec.token, ''); Logger.log('BUG: secretary got summary'); }
  catch (e) { Logger.log('OK secretary blocked: ' + e.message); }
  logout(s.token); logout(sec.token);
}
```

Expected: a JSON object with `date` = today and a `rows` array (one entry per secretary that has activity or pending rows); then `OK secretary blocked: AUTH`. Delete `_tmpSummary`.

- [ ] **Step 3: Commit**

```bash
git add Summary.js
git commit -m "feat: getAdminSummary endpoint (admin-only)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Client — login view, session, logout, error banner

**Files:**
- Modify: `Index.html` (add login view markup + CSS, banner markup + CSS, and a `<script>` auth section; gate the existing dashboard init behind auth)

**Interfaces:**
- Consumes: `login`, `resumeSession`, `logout` (Tasks 4); `google.script.run`.
- Produces (client globals used by Tasks 11–12):
  - `SESSION = { token, name, role }` — populated after auth.
  - `enterDashboard()` — called once auth succeeds; Task 11 fills its body to load data.
  - `showBanner(message, kind)` where `kind` is `'error'` or `'info'`; `clearBanner()`.
  - `localStorage` key `usd_token`.

- [ ] **Step 1: Add banner + login view markup**

In `Index.html`, immediately after `<body>`, before `<div id="app">`, insert:

```html
  <div id="banner" class="banner" hidden></div>

  <div id="loginView" class="login-view">
    <form id="loginForm" class="login-card">
      <h2>تسجيل الدخول</h2>
      <label>اسم المستخدم
        <input type="text" id="loginUser" autocomplete="username" required>
      </label>
      <label>كلمة المرور
        <input type="password" id="loginPass" autocomplete="current-password" required>
      </label>
      <button type="submit" id="loginBtn">دخول</button>
      <p id="loginError" class="login-error" hidden></p>
    </form>
  </div>
```

Then add `hidden` to the app container: change `<div id="app">` to `<div id="app" hidden>`.

- [ ] **Step 2: Add CSS for banner + login view**

Inside the existing `<style>` block, append:

```css
    .banner {
      padding: 12px 16px; margin-bottom: 16px; border-radius: 8px;
      font-size: 14px; cursor: pointer;
    }
    .banner.error { background: #fdecea; color: #b3261e; border: 1px solid #f6c9c4; }
    .banner.info  { background: #e8f0fe; color: #1a56c4; border: 1px solid #c6dafc; }
    .login-view {
      min-height: 70vh; display: flex; align-items: center; justify-content: center;
    }
    .login-card {
      background: #fff; padding: 28px 26px; border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12); width: 320px; max-width: 90vw;
      display: flex; flex-direction: column; gap: 14px;
    }
    .login-card h2 { margin: 0 0 4px; font-size: 18px; color: #333; }
    .login-card label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #444; }
    .login-card input {
      padding: 9px 11px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px;
    }
    .login-card button {
      margin-top: 4px; padding: 10px; border: none; border-radius: 6px;
      background: #1a73e8; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .login-card button:disabled { opacity: 0.6; cursor: default; }
    .login-error { margin: 0; color: #b3261e; font-size: 13px; }
```

- [ ] **Step 3: Add the auth `<script>` section**

Inside the existing `<script>` block, **replace** the final init lines:

```js
    setupSecretariatFilter();
    refreshSecretariatOptions();
    renderNav();
    renderTable();
```

with:

```js
    var SESSION = { token: null, name: null, role: null };

    function showBanner(message, kind) {
      var b = document.getElementById('banner');
      b.textContent = message;
      b.className = 'banner ' + (kind === 'info' ? 'info' : 'error');
      b.hidden = false;
      clearTimeout(showBanner._t);
      showBanner._t = setTimeout(clearBanner, 6000);
    }
    function clearBanner() { document.getElementById('banner').hidden = true; }
    document.getElementById('banner').addEventListener('click', clearBanner);

    function showLogin(msg) {
      document.getElementById('app').hidden = true;
      document.getElementById('loginView').hidden = false;
      var el = document.getElementById('loginError');
      if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; }
    }

    function doEnterDashboard() {
      document.getElementById('loginView').hidden = true;
      document.getElementById('app').hidden = false;
      enterDashboard(); // defined below; Task 11 fills the body
    }

    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var u = document.getElementById('loginUser').value;
      var p = document.getElementById('loginPass').value;
      var btn = document.getElementById('loginBtn');
      btn.disabled = true;
      google.script.run
        .withSuccessHandler(function (res) {
          btn.disabled = false;
          if (res && res.ok) {
            SESSION = { token: res.token, name: res.name, role: res.role };
            try { localStorage.setItem('usd_token', res.token); } catch (err) {}
            document.getElementById('loginPass').value = '';
            doEnterDashboard();
          } else if (res && res.error === 'locked') {
            showLogin('تم قفل الحساب مؤقتاً لكثرة المحاولات. حاول بعد ١٥ دقيقة.');
          } else {
            showLogin('اسم المستخدم أو كلمة المرور غير صحيحة.');
          }
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          showLogin('تعذّر تسجيل الدخول: ' + (err && err.message ? err.message : err));
        })
        .login(u, p);
    });

    function tryResume() {
      var saved = null;
      try { saved = localStorage.getItem('usd_token'); } catch (err) {}
      if (!saved) { showLogin(); return; }
      google.script.run
        .withSuccessHandler(function (res) {
          if (res && res.ok) {
            SESSION = { token: saved, name: res.name, role: res.role };
            doEnterDashboard();
          } else {
            try { localStorage.removeItem('usd_token'); } catch (err) {}
            showLogin();
          }
        })
        .withFailureHandler(function () { showLogin(); })
        .resumeSession(saved);
    }

    // enterDashboard is defined in Task 11. Provide a stub so this task runs
    // standalone; Task 11 replaces it.
    function enterDashboard() {
      setupSecretariatFilter();
      refreshSecretariatOptions();
      renderNav();
      renderTable();
    }

    tryResume();
```

- [ ] **Step 4: Add logout control to the toolbar**

In the toolbar markup, inside `<div class="toolbar-left">` after the `<h1>`, add:

```html
        <span id="whoami" class="whoami"></span>
        <button id="logoutBtn" class="logout-btn" type="button">خروج</button>
```

Add CSS (append to `<style>`):

```css
    .whoami { font-size: 12px; color: #666; margin-inline-start: 8px; }
    .logout-btn {
      border: 1px solid var(--border); background: #fff; color: #444;
      border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer;
    }
```

Add the handler (inside the `<script>`, after `tryResume();` is fine, or near the other listeners):

```js
    document.getElementById('logoutBtn').addEventListener('click', function () {
      var t = SESSION.token;
      SESSION = { token: null, name: null, role: null };
      try { localStorage.removeItem('usd_token'); } catch (err) {}
      if (t) google.script.run.logout(t);
      showLogin();
    });
```

- [ ] **Step 5: Push and browser-test**

Run: `clasp push -f`
Open the **Apps Script editor → Deploy → Test deployments → Web app URL** (the `@HEAD` dev URL). Then:
- Page shows the login card, dashboard hidden.
- Wrong credentials → red "غير صحيحة" message, stays on login.
- `h1` / `h11` → dashboard appears (tables may be empty/erroring — Task 11 wires data; that is expected).
- Reload the page → dashboard appears directly (session resumed from `localStorage`).
- Click خروج → back to login; reload stays on login.
- 5 wrong tries for one username → "تم قفل الحساب" message.

- [ ] **Step 6: Commit**

```bash
git add Index.html
git commit -m "feat: client login view, session resume, logout, error banner

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Client — wire dashboard to bootstrap, scoped tick writes, role-based filter

**Files:**
- Modify: `Index.html` (`<script>` — replace the `enterDashboard` stub; adapt data load, refresh, tick handlers, `data-code` on rows, aria-labels, "last updated")

**Interfaces:**
- Consumes: `getBootstrapData`, `refreshTabsData` (Task 5); `setRowDone`, `setRowSent` (Task 7); `SESSION`, `showBanner` (Task 10).
- Produces: a fully working scoped dashboard. `TABS_DATA` now loaded at runtime, not inlined.

- [ ] **Step 1: Remove the inlined-data global**

At the top of the `<script>`, the three template lines currently read:

```js
    var TABS_CONFIG = <?!= tabsConfigJson ?>;
    var COLUMN_HEADERS = <?!= columnHeadersJson ?>;
    var TABS_DATA = <?!= tabsDataJson ?>;
```

Change to:

```js
    var TABS_CONFIG = <?!= tabsConfigJson ?>;
    var COLUMN_HEADERS = <?!= columnHeadersJson ?>;
    var TABS_DATA = {};
```

- [ ] **Step 2: Replace the `enterDashboard` stub (from Task 10) with the real one**

```js
    function enterDashboard() {
      document.getElementById('whoami').textContent = SESSION.name || '';
      var filterBox = document.querySelector('.filter-box');
      if (filterBox) filterBox.style.display = (SESSION.role === 'admin') ? '' : 'none';
      var summary = document.getElementById('summaryPanel');
      if (summary) summary.hidden = (SESSION.role !== 'admin');

      setupSecretariatFilter();
      loadData(true);
    }

    function setLastUpdated() {
      var el = document.getElementById('lastUpdated');
      if (!el) return;
      var d = new Date();
      var hh = ('0' + d.getHours()).slice(-2);
      var mm = ('0' + d.getMinutes()).slice(-2);
      el.textContent = 'آخر تحديث ' + hh + ':' + mm;
    }

    function loadData(initial) {
      var btn = document.getElementById('refreshBtn');
      btn.classList.add('spinning');
      var runner = google.script.run
        .withSuccessHandler(function (res) {
          btn.classList.remove('spinning');
          TABS_DATA = (res && res.tabsData) ? res.tabsData : (res || {});
          refreshSecretariatOptions();
          renderNav();
          renderTable();
          setLastUpdated();
          if (SESSION.role === 'admin' && typeof loadSummary === 'function') loadSummary();
        })
        .withFailureHandler(function (err) {
          btn.classList.remove('spinning');
          var msg = (err && err.message) ? err.message : String(err);
          if (String(msg).indexOf('AUTH') !== -1) {
            try { localStorage.removeItem('usd_token'); } catch (e) {}
            showLogin('انتهت الجلسة. سجّل الدخول من جديد.');
          } else {
            showBanner('تعذّر تحميل البيانات: ' + msg, 'error');
          }
        });
      if (initial) runner.getBootstrapData(SESSION.token);
      else runner.refreshTabsData(SESSION.token);
    }
```

- [ ] **Step 3: Repoint the refresh button and delete the old `refreshData`**

The old `refreshData` function and its listener call `.refreshTabsData()` with no token. Replace the whole `refreshData` function with:

```js
    function refreshData() { loadData(false); }
```

(The existing `document.getElementById('refreshBtn').addEventListener('click', refreshData);` line stays.)

- [ ] **Step 4: Add `data-code` to rows and disable un-trackable checkboxes**

In `buildTableMarkup`, the row open tag currently is:

```js
          html += '<tr class="' + rowClasses + '" data-sheet-row="' + row.sheetRow + '">';
```

Change to:

```js
          var noCode = !row.code;
          html += '<tr class="' + rowClasses + '" data-sheet-row="' + row.sheetRow +
                  '" data-code="' + escapeAttr(row.code || '') + '">';
```

And the two checkbox cells currently are:

```js
          html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox" ' + (row.done ? 'checked' : '') + ' /></td>';
          if (showSentColumn) {
            html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox-sent" ' + (row.sent ? 'checked' : '') + ' /></td>';
          }
```

Change to:

```js
          html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox" aria-label="تحديد كمنجز" ' +
                  (row.done ? 'checked ' : '') + (noCode ? 'disabled title="لا يمكن التتبع: لا يوجد Code" ' : '') + '/></td>';
          if (showSentColumn) {
            html += '<td class="tick-cell"><input type="checkbox" class="tick-checkbox-sent" aria-label="تحديد أنجاز" ' +
                    (row.sent ? 'checked ' : '') + (noCode ? 'disabled title="لا يمكن التتبع: لا يوجد Code" ' : '') + '/></td>';
          }
```

- [ ] **Step 5: Add an `aria-label` to each table**

In `buildTableMarkup`, change `'<table class="data-table">...'` opening to:

```js
      var html = '<table class="data-table" aria-label="' + escapeAttr(tab.label) + '"><thead><tr>';
```

- [ ] **Step 6: Send `code` + row hint from the tick change handler**

The change handler currently ends with:

```js
        })[config.serverFn](sheetName, Number(sheetRow), checked);
```

and reads `var sheetRow = tr.getAttribute('data-sheet-row');`. Update the handler block: after `var tr = checkbox.closest('tr');` add:

```js
      var code = tr.getAttribute('data-code');
```

Replace the failure handler + call tail:

```js
        .withFailureHandler(function (err) {
          checkbox.disabled = false;
          checkbox.checked = !checked;
          tr.classList.toggle(config.rowClass, !checked);
          var msg = (err && err.message) ? err.message : String(err);
          if (String(msg).indexOf('AUTH') !== -1) {
            try { localStorage.removeItem('usd_token'); } catch (e) {}
            showLogin('انتهت الجلسة. سجّل الدخول من جديد.');
          } else if (String(msg).indexOf('NOT_YOUR_ROW') !== -1) {
            showBanner('لا يمكنك تعديل صف سكرتارية أخرى.', 'error');
          } else if (String(msg).indexOf('DONE_FIRST') !== -1) {
            showBanner('حدد "منجز" أولاً قبل "أنجاز".', 'error');
          } else if (/NOT_FOUND|AMBIGUOUS|NO_CODE/.test(String(msg))) {
            showBanner('تعذّر تحديد الصف. اضغط تحديث ثم أعد المحاولة.', 'error');
          } else {
            showBanner('تعذّر الحفظ: ' + msg, 'error');
          }
        })[config.serverFn](SESSION.token, sheetName, code, Number(sheetRow), checked);
```

And update the success handler to use the returned `{code, done, sent}`:

```js
        .withSuccessHandler(function (updated) {
          updateLocalTickState(sheetName, sheetRow, config.field, checked);
          renderTable();
        })
```

(Leaving `updateLocalTickState` keyed on `sheetRow` is fine — it still matches the in-memory row.)

- [ ] **Step 7: Add the "last updated" element**

In the toolbar, after the refresh button, add:

```html
        <span id="lastUpdated" class="whoami"></span>
```

- [ ] **Step 8: Push and browser-test (dev URL)**

Run: `clasp push -f`
On the `@HEAD` web app URL:
- Log in as `h1`/`h11` → only that secretary's rows across the 3 tabs; **no** سكرتارية dropdown; "logged in as" shows her name; "آخر تحديث HH:MM" appears.
- Tick Done on one of her rows → row turns green, stays; open the sheet → `Done` in J, timestamp L, `h1` in M; `ActivityLog` row appended.
- Tick أنجاز before Done on a fresh row → banner "حدد منجز أولاً".
- Refresh button → spins, reloads her scoped data.
- Log in as `a1`/`a11` → all rows, dropdown visible, can tick any row.
- Let the session sit (or delete the `sess_` property in the editor) then act → "انتهت الجلسة" and back to login.

- [ ] **Step 9: Commit**

```bash
git add Index.html
git commit -m "feat: scoped dashboard load, Code-keyed tick writes, role-based filter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Client — admin summary panel

**Files:**
- Modify: `Index.html` (markup + CSS + `<script>` `loadSummary`/`renderSummary`)

**Interfaces:**
- Consumes: `getAdminSummary` (Task 9); `SESSION`, `showBanner` (Task 10); `enterDashboard`/`loadData` call `loadSummary` when `role==='admin'` (Task 11).
- Produces: `loadSummary()`, `renderSummary(data)`; a `#summaryPanel` shown only for admin.

- [ ] **Step 1: Add the panel markup**

Immediately after `<div id="tabNav" class="tab-nav"></div>` (inside `#app`), insert:

```html
    <div id="summaryPanel" class="summary-panel" hidden>
      <div class="summary-head">
        <strong>ملخص اليوم لكل سكرتارية</strong>
        <input type="date" id="summaryDate">
      </div>
      <div class="table-scroll">
        <table class="data-table" id="summaryTable" aria-label="ملخص الأداء">
          <thead><tr>
            <th>السكرتارية</th><th>منجز</th><th>أنجاز</th><th>تراجع</th>
            <th>متوسط الدقائق (منجز→أنجاز)</th><th>أقدم طلب معلّق (ساعات)</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
```

- [ ] **Step 2: Add CSS**

```css
    .summary-panel {
      background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      margin-bottom: 16px; overflow: hidden;
    }
    .summary-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 10px 14px; background: #f5f6f8; border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .summary-head input[type="date"] {
      padding: 6px 9px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;
    }
    #summaryTable th { background: #37474f; color: #fff; }
```

- [ ] **Step 3: Add `loadSummary` / `renderSummary` to `<script>`**

```js
    function loadSummary() {
      var dateInput = document.getElementById('summaryDate');
      var dateStr = dateInput.value || '';
      google.script.run
        .withSuccessHandler(function (res) {
          if (dateInput && res && res.date && !dateInput.value) dateInput.value = res.date;
          renderSummary(res);
        })
        .withFailureHandler(function (err) {
          showBanner('تعذّر تحميل الملخص: ' + (err && err.message ? err.message : err), 'error');
        })
        .getAdminSummary(SESSION.token, dateStr);
    }

    function renderSummary(res) {
      var tbody = document.querySelector('#summaryTable tbody');
      tbody.innerHTML = '';
      var rows = (res && res.rows) || [];
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">لا يوجد نشاط لهذا اليوم</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(r.secretary) + '</td>' +
          '<td>' + r.done + '</td>' +
          '<td>' + r.sent + '</td>' +
          '<td>' + r.untick + '</td>' +
          '<td>' + (r.avgMinutes == null ? '—' : r.avgMinutes) + '</td>' +
          '<td>' + r.oldestPendingHours + '</td>';
        tbody.appendChild(tr);
      });
    }

    document.getElementById('summaryDate').addEventListener('change', loadSummary);
```

- [ ] **Step 4: Push and browser-test (dev URL)**

Run: `clasp push -f`
- Log in as `a1`/`a11` → summary panel visible above the tabs, date defaults to today, one row per active secretary with counts.
- Tick a couple of rows as `a1`, change nothing else, click refresh → counts increase.
- Change the date picker to yesterday → numbers change (or "لا يوجد نشاط").
- Log in as `h1`/`h11` → summary panel not shown.

- [ ] **Step 5: Commit**

```bash
git add Index.html
git commit -m "feat: admin daily summary panel with date picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Full integration test, deploy, close-out

**Files:**
- No code changes unless a check fails (then fix in the relevant task's file and re-commit).

**Interfaces:**
- Consumes: everything.
- Produces: the live web app on the versioned deployment `AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O`.

- [ ] **Step 1: Run the whole Node test suite**

Run:
```bash
node tests/auth.test.js && node tests/shape.test.js && node tests/activity.test.js && node tests/summary.test.js
```
Expected: four `... OK` lines, exit 0.

- [ ] **Step 2: Run `runTests_()` in the editor**

Expected log: `runTests_: ALL PASS`.

- [ ] **Step 3: Push and run the manual checklist on the `@HEAD` dev URL**

Run: `clasp push -f`

Checklist (all must pass):
1. Fresh browser / incognito → login card shown, no dashboard, no data in page source (View Source → search for a known ID value → not present).
2. Wrong password ×5 on one username → lockout message; correct password now also blocked ~15 min.
3. Log in as a secretary (`h1`/`h11`) → sees only her rows in all 3 tabs; no سكرتارية filter; name shown; "آخر تحديث".
4. Tick Done → green, `Done`+`DoneAt`+`DoneBy(h1)` in the sheet, `ActivityLog` row `action=done newValue=Done`.
5. Move that row to the Done table, tick أنجاز → navy, `Sent`+`SentAt`+`SentBy`, `ActivityLog` `action=sent`.
6. Un-tick أنجاز then Done → cells cleared, two more `ActivityLog` rows with `newValue` empty.
7. Attempt (as `h1`) to tick a row belonging to another secretary: not visible, so cannot — confirm the other secretary's rows are absent.
8. Reload page → session resumes, dashboard directly.
9. خروج → login; reload stays on login.
10. Log in as admin (`a1`/`a11`) → all rows, filter visible, summary panel with today's counts; date picker changes numbers; can tick any row.
11. Break a row's `Code` (blank it) in the sheet, refresh → that row's checkboxes disabled with tooltip; restore the `Code`.

- [ ] **Step 4: Redeploy the production web app**

Run:
```bash
clasp deploy --deploymentId AKfycbxIiT5WV92N6ksIYc0xCRKtegLNPCZpC-ubAFKDFGVLsfd9h0I2QQ69w5wFdCFY8X8O --description "Login + accountability: auth, scoping, activity log, admin summary"
```
Expected: `Deployed AKfycbx... @NN` with `NN` > 12.

- [ ] **Step 5: Verify the production URL**

Open the production web app URL (Deploy → Manage deployments → the versioned one). Repeat checklist items 1, 3, 4, 10. All pass.

- [ ] **Step 6: Final commit + tag**

```bash
git add -A
git commit -m "chore: deploy login + accountability release

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" --allow-empty
git tag login-accountability-v1
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §1 Login tab / ADMIN_USERNAME constant | 2, 3 (`checkCredentials_` role), 4 (`readLoginRows_`) |
| §1 ActivityLog columns | 7 (`appendActivity_`) |
| §1 Data sheet columns L–O / SHEET_COLUMN_COUNT=15 | 2 |
| §1 setup_() | 2 |
| §1 Row key = Code; blank/dup/missing handling | 6 (`findRowByCode_`), 11 (client disable on blank) |
| §2 doGet no embedded data | 5 |
| §2 access stays ANYONE_ANONYMOUS | unchanged (Global Constraints; no task edits `appsscript.json`) |
| §2 session lifecycle, 8h sliding | 4 (`createSession_`, `touchSession_`, `requireSession_`) |
| §2 login lockout 5 / 15 min | 4 (`lockoutCount_`/`bumpLockout_`), 10 (client message), 13 (checklist) |
| §2 resume / logout | 4, 10 |
| §2 endpoint auth table | 4, 5, 7, 9 (each entry point calls `requireSession_`) |
| §3 secretary scoping | 5 (`shapeSheetValues_` scope, `getBootstrapData`) |
| §3 admin unfiltered + summary access | 5, 9 |
| §3 order enforcement server-side | 7 (`tickGuard_` DONE_FIRST) |
| §3 filter hidden for secretaries | 11 |
| §4 tick write flow (key, ownership, order, stamp, log, return) | 7 |
| §5 admin summary panel + date picker | 8 (aggregation), 9 (endpoint), 12 (UI) |
| §6 delete backups | 1 |
| §6 alert() → banner | 10 (banner), 11 (all tick/load errors use `showBanner`/`showLogin`) |
| §6 aria-labels | 11 |
| §6 "last updated" | 11 |
| §6 "logged in as" + logout | 10 |
| §7 runTests_ + node tests + manual checklist | 3, 4, 5, 6, 7, 8, 13 |
| Known ceilings documented in code | 4 (`ponytail:` comment in `Auth.js` header) |

No gaps.

**2. Placeholder scan**

No "TBD"/"handle edge cases"/"similar to"/"implement later" anywhere. All error-handling paths are spelled out with exact user-facing messages. Every code step has a full code block. OK.

**3. Type consistency**

- `SESSION` shape `{token,name,role}` — set identically in Task 10 (login, resume) and read in Tasks 11–12.
- `login` returns `{ok, token, name, role}` / `{ok:false, error}` — matches client handling in Task 10.
- `getBootstrapData` returns `{tabsData, name, role}`; `refreshTabsData` returns the bare `{sheetName:[...]}` map — client Task 11 handles both via `res.tabsData ? res.tabsData : res`.
- `setRowDone`/`setRowSent` signature `(token, sheetName, code, rowHint, value)` — defined Task 7, called Task 11 Step 6 with `(SESSION.token, sheetName, code, Number(sheetRow), checked)`. Match.
- Return `{code, done, sent}` — produced Task 7, consumed Task 11 success handler (currently only re-renders; acceptable).
- `findRowByCode_` returns `{index0, sheetRow}` — used in Task 7 `writeTick_`. Match.
- `aggregateSummary_` row shape `{secretary, done, sent, untick, avgMinutes, oldestPendingHours}` — produced Task 8, rendered Task 12 with those exact keys. Match.
- `getAdminSummary` returns `{date, rows}` — Task 9, consumed Task 12 `renderSummary`. Match.
- `COL` indices consistent (DONE_AT 11 … SENT_BY 14) across Tasks 2, 7, 8.

No inconsistencies found.
