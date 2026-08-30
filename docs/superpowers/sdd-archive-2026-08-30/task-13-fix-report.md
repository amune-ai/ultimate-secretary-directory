# Task 13 — Final-review fix wave

Branch: `login-accountability`
Commit: `23c9379` — fix: address final-review findings (scrub test credential, blank-name guard, un-tick cascade, client cleanups)

## Findings applied

### FINDING 1 (Critical) — scrub real-looking credential
- `tests/auth.test.js:8` — fixture row `{ username: 'alajmi5635', password: 'xxxxxxxxx', name: 'وضحة الحجرف' }` → `{ username: 'w1', password: 'w11', name: 'وضحة الحجرف' }`.
- `docs/superpowers/plans/2026-08-30-login-accountability.md:230` — same line, same replacement.
- No test assertion further down referenced `alajmi5635`/`xxxxxxxxx` (only the fixture line), so nothing else needed updating.
- Grep: `grep -rn "alajmi5635\|xxxxxxxxx" . | grep -v node_modules` → **ZERO HITS**.

### FINDING 2 (Important) — blank Login-tab Name fails open to full dataset
- `Auth.js` `checkCredentials_` (lines ~24-28): restructured the successful-match return to compute `name` and `role` first, then `if (role !== 'admin' && name === '') return null;` before `return { username: u, name: name, role: role };`. Empty-password guard and loop structure unchanged.
- Tests added to `tests/auth.test.js`:
  - Fixture row `{ username: 'noname', password: 'x1', name: '  ' }`.
  - `assert.strictEqual(checkCredentials_(rows, 'noname', 'x1'), null);` (non-admin, whitespace name → rejected).
  - `assert.deepStrictEqual(checkCredentials_([{ username: 'a1', password: 'a11', name: '' }], 'a1', 'a11'), { username: 'a1', name: '', role: 'admin' });` (admin exempt — separate array to avoid colliding with the existing `a1` fixture row).
  - Existing assertions still pass.

### FINDING 3 (Important) — un-ticking Done leaves row Sent-but-not-Done
- `Activity.js` `writeTick_` (after the primary `appendActivity_` call): added cascade block —
  when `action === 'done' && !value && isSent_(row[COL.SENT])`, clear `COL.SENT` / `COL.SENT_AT` / `COL.SENT_BY` and append a second ActivityLog row `appendActivity_(sheetName, code, session, 'sent', 'Sent', '')`.
- Return recomputed: `sentNow = (action === 'sent') ? !!value : (action === 'done' && !value ? false : isSent_(row[COL.SENT]))`. `doneNow` unchanged. Invariant now holds: `sent` is never true when `done` is false.
- Tests added to `tests/activity.test.js` (per the finding — no stubbed `SpreadsheetApp`): defined `global.isSent_`, added a comment noting the cascade is covered by Task 13 manual checklist item 6, and pinned the primitives the cascade branches on:
  - `assert.strictEqual(global.isDone_(''), false);`
  - `assert.strictEqual(global.isSent_(''), false);`
  - `assert.strictEqual(global.isSent_('Sent'), true);`
  - Prints `activity.test.js cascade primitives OK`.

### FINDING 4 (Minor) — tick success handler ignored server response
- `Index.html` `updateLocalTickState` — signature changed to `updateLocalTickState(sheetName, code, updated)`; matches on `String(rows[i].code) === String(code)`; sets both `rows[i].done = updated.done` and `rows[i].sent = updated.sent` (so Finding 3's cascade renders without a refresh).
- Call site in the tick `change` success handler updated to `updateLocalTickState(sheetName, code, updated);` (arg renamed `updated`). `renderTable()` call kept. `data-sheet-row` / `Number(sheetRow)` still passed to the server as the duplicate-code rowHint.
- `grep -c "function updateLocalTickState" Index.html` → **1**.

### FINDING 5 (Minor) — PDF href scheme not restricted
- `Index.html` `pdfIconCell` first line: `if (!url || !/^https?:\/\//i.test(String(url))) return '<span class="no-pdf">&mdash;</span>';` (replaced the bare `if (!url)` check). Non-http(s) column-F values now render as an em-dash instead of a live `href`/`window.open()` target.

### FINDING 6 (Minor) — no re-entrancy guard on refresh
- `Index.html` `refreshData` now no-ops while the refresh button carries the `spinning` class:
  `if (!document.getElementById('refreshBtn').classList.contains('spinning')) loadData(false);`

### FINDING 8 (Minor) — logout leaves prior user's PII in memory/DOM
- `Index.html` logout click handler, before `showLogin()`: `TABS_DATA = {};`, `document.getElementById('tableWrap').innerHTML = '';`, and `var st = document.querySelector('#summaryTable tbody'); if (st) st.innerHTML = '';`

## Verification

```
grep -rn "alajmi5635\|xxxxxxxxx" . | grep -v node_modules   → ZERO HITS
node tests/auth.test.js       → auth.test.js OK
node tests/activity.test.js   → activity.test.js OK
                                activity.test.js guard OK
                                activity.test.js cascade primitives OK
node tests/shape.test.js      → shape.test.js OK
node tests/summary.test.js    → summary.test.js OK
node --check Auth.js Activity.js Code.js  → all .js OK
Index.html script-parse check → script parses OK
grep -c "function updateLocalTickState" Index.html → 1
```

## clasp push -f

```
Pushed 7 files at 6:13:36 AM.
└─ Activity.js
└─ appsscript.json
└─ Auth.js
└─ Code.js
└─ Index.html
└─ Setup.js
└─ Summary.js
```
`tests/` correctly excluded (7 non-test files only). `clasp deploy` NOT run.

## Commit

`23c9379f98c07c91328919aa63a192fa18620ffb` (short `23c9379`)

## Not done / caveats

- None. All 7 findings applied, all 4 test suites green, credential scrubbed repo-wide, clasp push clean.
